"""Queue-triggered processor — orchestrates the full 12-step resume processing pipeline."""

import json
import uuid
from datetime import datetime

from processing.text_extractor import extract_text
from processing.llm_client import call_llm, parse_llm_json
from processing.resume_parser import parse_resume
from processing.scorer import (
    calculate_total_experience,
    calculate_relevant_experience,
    match_candidate_skills,
    calculate_score,
    get_rejection_reasons,
    classify_candidate,
)
from processing.risk_analyzer import analyze_risks
from processing.recommender import get_recommendation, get_screening_status
from processing.duplicate_detector import compute_file_hash, check_duplicate_at_processing
from storage.blob_client import download_resume, copy_resume_to_folder
from storage.cosmos_client import (
    get_jd,
    upsert_candidate,
    increment_batch_counter,
    check_duplicate_by_hash,
)
from models.candidate_model import (
    Candidate,
    PersonalInfo,
    ExperienceInfo,
    ExperienceEntry,
    ConfidenceScores,
    CostTracking,
)
from utils.date_utils import replace_current_markers, is_stale_resume
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


RECRUITER_SUMMARY_PROMPT = """You are a senior recruiter assistant. Generate a concise 2-3 sentence recruiter summary for this candidate.

Include:
- Their strongest qualifications relevant to the role
- Notable certifications if any
- Any concerns (risk flags) briefly
- A hiring recommendation note

Keep it professional and actionable. Return only the summary text, no JSON, no formatting.

Candidate Data:
"""


def _build_skill_timeline(individual_raw: list[dict]) -> dict[str, dict]:
    """Build a mapping of skill -> {period, project} from most recent usage.
    
    For each skill found in work experience, find the most recent project
    where it was used and record the time period and organization name.
    """
    skill_map = {}  # skill_lower -> {period, project, end_sort_key}

    for entry in individual_raw:
        org = entry.get("organization", "Unknown")
        start_end = entry.get("start_end", "NDATA")
        skills_used = entry.get("skills_used", [])

        if start_end == "NDATA" or not skills_used:
            continue

        # Parse end date for recency comparison
        parts = start_end.split("-")
        end_part = parts[1] if len(parts) == 2 else parts[0]

        # Format period for display (e.g., "Jan2022 – Mar2025")
        period = start_end.replace("-", " – ") if "-" in start_end else start_end

        for skill in skills_used:
            skill_lower = skill.lower()
            existing = skill_map.get(skill_lower)
            if existing is None:
                skill_map[skill_lower] = {
                    "period": period,
                    "project": org,
                    "end_sort": end_part,
                }
            else:
                # Keep most recent (simple string compare works for MMMYYYY with month abbreviations)
                # Use a safer numeric approach
                if _date_key(end_part) > _date_key(existing["end_sort"]):
                    skill_map[skill_lower] = {
                        "period": period,
                        "project": org,
                        "end_sort": end_part,
                    }

    # Return clean output without sort key
    return {
        skill: {"period": info["period"], "project": info["project"]}
        for skill, info in skill_map.items()
    }


def _date_key(date_str: str) -> int:
    """Convert MMMYYYY to sortable int (e.g., Jun2024 -> 202406)."""
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    if len(date_str) < 4:
        return 0
    month_str = date_str[:3].lower()
    year_str = date_str[3:]
    month = months.get(month_str, 0)
    try:
        year = int(year_str)
    except ValueError:
        return 0
    return year * 100 + month


def process_resume_message(message_body: str):
    """Process a single resume from a queue message.
    
    This is the main entry point called by the Azure Function queue trigger.
    Executes all 12 steps of the pipeline.
    """
    # Parse queue message
    try:
        msg = json.loads(message_body)
    except json.JSONDecodeError as e:
        log_with_context(logger, "ERROR", f"Invalid queue message: {e}", stage="queue_parse")
        return

    resume_blob_path = msg["resume_blob_path"]
    jd_id = msg["jd_id"]
    batch_id = msg["batch_id"]
    file_name = msg["file_name"]
    trace_id = f"{batch_id}_{file_name}"

    log_with_context(logger, "INFO", f"Processing started: {file_name}",
                    trace_id=trace_id, stage="start")

    total_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    try:
        # =============================================
        # STEP 1: Text Extraction
        # =============================================
        file_bytes = download_resume(resume_blob_path)
        resume_hash = compute_file_hash(file_bytes)

        # Idempotency check: if already processed (same jd_id + hash), skip
        existing = check_duplicate_by_hash(jd_id, resume_hash)
        if existing and existing.get("is_duplicate") is False:
            log_with_context(logger, "INFO", f"Already processed (idempotency check), skipping",
                            trace_id=trace_id, stage="idempotency")
            return

        raw_text = extract_text(file_bytes, file_name)
        if not raw_text.strip():
            log_with_context(logger, "ERROR", f"Empty text extracted from {file_name}",
                            trace_id=trace_id, stage="text_extraction")
            increment_batch_counter(batch_id, "failed")
            return

        # Normalize date markers
        text = replace_current_markers(raw_text)

        # =============================================
        # STEP 2: Load JD Config
        # =============================================
        jd = get_jd(jd_id)
        if not jd:
            log_with_context(logger, "ERROR", f"JD not found: {jd_id}",
                            trace_id=trace_id, stage="jd_load")
            increment_batch_counter(batch_id, "failed")
            return

        jd_skills = jd.get("skills", {})

        # =============================================
        # STEP 3: LLM Extraction (Single Call)
        # =============================================
        parsed_data, usage = parse_resume(text, jd_skills, trace_id=trace_id)
        _accumulate_tokens(total_tokens, usage)

        if parsed_data is None:
            log_with_context(logger, "ERROR", f"LLM extraction failed for {file_name}",
                            trace_id=trace_id, stage="resume_parsing")
            increment_batch_counter(batch_id, "failed")
            return

        # =============================================
        # STEP 4: Extract Personal Info & Duplicate Check
        # =============================================
        personal_data = parsed_data.get("personal", {})
        personal = PersonalInfo(
            name=personal_data.get("name", "NDATA"),
            email=personal_data.get("email", "NDATA"),
            phone=personal_data.get("phone", "NDATA"),
            location=personal_data.get("location", "NDATA"),
            linkedin=personal_data.get("linkedin", "NDATA"),
            current_organization=personal_data.get("current_organization", "NDATA"),
        )

        # Duplicate check (email/phone level)
        dup = check_duplicate_at_processing(
            jd_id=jd_id,
            email=personal.email,
            phone=personal.phone,
            resume_hash=resume_hash,
            trace_id=trace_id,
        )
        if dup:
            # Mark as duplicate
            dup_candidate = Candidate(
                id=str(uuid.uuid4()),
                jd_id=jd_id,
                batch_id=batch_id,
                file_name=file_name,
                resume_hash=resume_hash,
                personal=personal,
                is_duplicate=True,
                duplicate_of=dup.get("id"),
                classification_folder="duplicates",
            )
            upsert_candidate(dup_candidate.to_cosmos_dict())
            copy_resume_to_folder(batch_id, file_name, "duplicates")
            increment_batch_counter(batch_id, "duplicates")
            log_with_context(logger, "INFO", f"Duplicate detected, skipped: {file_name}",
                            trace_id=trace_id, stage="duplicate_check")
            return

        # =============================================
        # STEP 5: Experience Calculation
        # =============================================
        exp_data = parsed_data.get("experience", {})
        individual_raw = exp_data.get("individual", [])

        individual_entries = [
            ExperienceEntry(
                organization=e.get("organization", "Unknown"),
                start_end=e.get("start_end", "NDATA"),
                duration_years=float(e.get("duration_years", 0)),
                skills_used=e.get("skills_used", []),
            )
            for e in individual_raw
        ]

        total_exp = calculate_total_experience(individual_raw)

        # Relevant skills = primary + secondary from JD
        relevant_skills = jd_skills.get("primary", []) + jd_skills.get("secondary", [])
        relevant_exp = calculate_relevant_experience(individual_raw, relevant_skills)

        last_work_date = exp_data.get("last_work_date", "NDATA")
        freshness_flag = is_stale_resume(last_work_date) if last_work_date != "NDATA" else False

        experience = ExperienceInfo(
            total_years=total_exp,
            relevant_years=relevant_exp,
            last_work_date=last_work_date,
            freshness_flag=freshness_flag,
            summary=exp_data.get("summary", "NDATA"),
            individual=individual_entries,
        )

        # Build skill timeline from project experience
        skill_timeline = _build_skill_timeline(individual_raw)

        # =============================================
        # STEP 6: Skills Matching
        # =============================================
        technical_skills = parsed_data.get("technical_skills", [])
        skills_matched = match_candidate_skills(individual_raw, parsed_data.get("certifications", []), jd, technical_skills)

        # =============================================
        # STEP 7: Gap & Discrepancy Detection (Risk Analysis)
        # =============================================
        domain_classification = parsed_data.get("domain_classification", "General")
        risk_flags, gaps_desc, disc_desc = analyze_risks(
            individual_raw, last_work_date, domain_classification, trace_id=trace_id
        )

        # =============================================
        # STEP 8: Match Scoring
        # =============================================
        certifications = parsed_data.get("certifications", [])
        scoring = calculate_score(skills_matched, total_exp, certifications, jd, risk_flags)

        # =============================================
        # STEP 9: Rejection Reasons
        # =============================================
        rejection_reasons = get_rejection_reasons(skills_matched, total_exp, jd)

        # =============================================
        # STEP 10: Recommendation
        # =============================================
        recommendation = get_recommendation(scoring.match_score, risk_flags, rejection_reasons)
        screening = get_screening_status(recommendation)

        # =============================================
        # STEP 11: Folder Classification
        # =============================================
        classification_folder = classify_candidate(scoring.match_score, rejection_reasons, jd)

        # =============================================
        # STEP 12: Recruiter Summary (LLM Call #2)
        # =============================================
        summary_context = (
            f"Role: {jd.get('title', 'Unknown')}\n"
            f"Name: {personal.name}\n"
            f"Total Experience: {total_exp} years\n"
            f"Relevant Experience: {relevant_exp} years\n"
            f"Match Score: {scoring.match_score}%\n"
            f"Recommendation: {recommendation}\n"
            f"Certifications: {', '.join(certifications) if certifications else 'None'}\n"
            f"Risk Flags: {'; '.join(risk_flags) if risk_flags else 'None'}\n"
            f"Rejection Reasons: {'; '.join(rejection_reasons) if rejection_reasons else 'None'}\n"
            f"Domain: {domain_classification}\n"
        )

        summary_response, summary_usage = call_llm(
            system_prompt=RECRUITER_SUMMARY_PROMPT,
            user_content=summary_context,
            trace_id=trace_id,
            stage="recruiter_summary",
        )
        _accumulate_tokens(total_tokens, summary_usage)
        recruiter_summary = summary_response.strip()

        # =============================================
        # Build & Save Candidate Record
        # =============================================
        confidence_data = parsed_data.get("confidence", {})
        confidence = ConfidenceScores(
            name=confidence_data.get("name_confidence", "Low"),
            email=confidence_data.get("email_confidence", "Low"),
            experience_years=confidence_data.get("experience_years_confidence", "Low"),
            skills=confidence_data.get("skills_confidence", "Low"),
        )

        candidate = Candidate(
            id=str(uuid.uuid4()),
            jd_id=jd_id,
            batch_id=batch_id,
            file_name=file_name,
            resume_hash=resume_hash,
            personal=personal,
            experience=experience,
            skills_matched=skills_matched,
            certifications=certifications,
            domain_classification=domain_classification,
            scoring=scoring,
            risk_flags=risk_flags,
            gaps=gaps_desc,
            discrepancy=disc_desc,
            recommendation=recommendation,
            screening=screening,
            rejection_reasons=rejection_reasons,
            classification_folder=classification_folder,
            recruiter_summary=recruiter_summary,
            skill_timeline=skill_timeline,
            confidence_scores=confidence,
            cost_tracking=CostTracking(**total_tokens),
            is_duplicate=False,
            duplicate_of=None,
        )

        # Save to Cosmos
        upsert_candidate(candidate.to_cosmos_dict())

        # Move to classified folder
        copy_resume_to_folder(batch_id, file_name, classification_folder)

        # Update batch counter
        increment_batch_counter(batch_id, "processed")

        log_with_context(
            logger, "INFO",
            f"Completed: {file_name} | Score: {scoring.match_score} | Rec: {recommendation}",
            trace_id=trace_id, stage="complete",
            tokens_used=total_tokens["total_tokens"],
        )

    except Exception as e:
        log_with_context(logger, "ERROR", f"Pipeline failed for {file_name}: {e}",
                        trace_id=trace_id, stage="pipeline_error")
        increment_batch_counter(batch_id, "failed")
        # Don't re-raise: failure is recorded in batch counter.
        # Re-raising causes queue retry which inflates the failed count.


def _accumulate_tokens(total: dict, usage: dict):
    """Add token counts from a usage dict to the running total."""
    total["prompt_tokens"] += usage.get("prompt_tokens", 0)
    total["completion_tokens"] += usage.get("completion_tokens", 0)
    total["total_tokens"] += usage.get("total_tokens", 0)
