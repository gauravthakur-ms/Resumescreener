"""Match scoring engine — uses JD-defined weights, never hardcoded."""

from models.jd_model import JobDescription
from models.candidate_model import Candidate, Scoring, SkillsMatched
from utils.skills_normalizer import match_skills_against_jd
from utils.date_utils import duration_in_years
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def calculate_total_experience(individual_exp: list[dict]) -> float:
    """Calculate total experience from individual experience entries."""
    total = 0.0
    for entry in individual_exp:
        dur = entry.get("duration_years", 0)
        if isinstance(dur, (int, float)):
            total += dur
        else:
            # Try parsing from start_end
            start_end = entry.get("start_end", "NDATA")
            if start_end and start_end != "NDATA":
                total += duration_in_years(start_end)
    return round(total, 1)


def calculate_relevant_experience(individual_exp: list[dict], relevant_skills: list[str]) -> float:
    """Calculate relevant experience — sum of durations where relevant skills were used."""
    relevant = 0.0
    relevant_lower = {s.lower() for s in relevant_skills}

    for entry in individual_exp:
        skills_used = [s.lower() for s in entry.get("skills_used", [])]
        if any(s in relevant_lower or any(rs in s for rs in relevant_lower) for s in skills_used):
            dur = entry.get("duration_years", 0)
            if isinstance(dur, (int, float)):
                relevant += dur
            else:
                start_end = entry.get("start_end", "NDATA")
                if start_end and start_end != "NDATA":
                    relevant += duration_in_years(start_end)

    return round(relevant, 1)


def match_candidate_skills(
    individual_exp: list[dict],
    certifications: list[str],
    jd: dict,
    technical_skills: list[str] | None = None,
) -> SkillsMatched:
    """Match candidate skills against JD categories."""
    # Collect all skills from work experience
    all_candidate_skills = set()
    for entry in individual_exp:
        for skill in entry.get("skills_used", []):
            all_candidate_skills.add(skill)

    # Also include skills extracted from the full resume (skills section, projects, etc.)
    if technical_skills:
        for skill in technical_skills:
            all_candidate_skills.add(skill)

    skills_config = jd.get("skills", {})
    candidate_skills_list = list(all_candidate_skills)

    matched = SkillsMatched(
        primary=match_skills_against_jd(candidate_skills_list, skills_config.get("primary", [])),
        secondary=match_skills_against_jd(candidate_skills_list, skills_config.get("secondary", [])),
    )
    return matched


def calculate_score(
    skills_matched: SkillsMatched,
    total_exp: float,
    certifications_found: list[str],
    jd: dict,
    risk_flags: list[str],
) -> Scoring:
    """Calculate match score using JD-defined weights.
    
    Formula:
        primary_score    = (matched / total) * weight * 100
        secondary_score  = (matched / total) * weight * 100
        experience_score = min(actual / required, 1.0) * weight * 100
        cert_score       = (matched / max(total, 1)) * weight * 100
        risk_penalty     = -5 per risk flag (max -15)
        match_score      = sum, clamped to [0, 100]
    """
    weights = jd.get("scoring_weights", {})
    w_primary = weights.get("primary_skills", 0.40)
    w_secondary = weights.get("secondary_skills", 0.25)
    w_experience = weights.get("experience", 0.25)
    w_certs = weights.get("certifications", 0.10)

    # Primary
    primary_matched = sum(1 for v in skills_matched.primary.values() if v)
    primary_total = max(len(skills_matched.primary), 1)
    primary_score = (primary_matched / primary_total) * w_primary * 100

    # Secondary
    secondary_matched = sum(1 for v in skills_matched.secondary.values() if v)
    secondary_total = max(len(skills_matched.secondary), 1)
    secondary_score = (secondary_matched / secondary_total) * w_secondary * 100

    # Experience
    min_exp = jd.get("min_experience_years", 1)
    exp_ratio = min(total_exp / max(min_exp, 1), 1.0)
    experience_score = exp_ratio * w_experience * 100

    # Certifications (substring match to handle prefixes like "Microsoft Certified: ...")
    certs_preferred = jd.get("certifications_preferred", [])
    certs_found_lower = [c.lower() for c in certifications_found]
    certs_matched = 0
    for pref_cert in certs_preferred:
        pref_lower = pref_cert.lower()
        if any(pref_lower in found or found in pref_lower for found in certs_found_lower):
            certs_matched += 1
    certs_total = max(len(certs_preferred), 1)
    certification_score = (certs_matched / certs_total) * w_certs * 100

    # Risk penalty
    risk_penalty = min(len(risk_flags) * -5.0, 0)  # Max -15

    # Total
    match_score = (
        primary_score + secondary_score + experience_score +
        certification_score + risk_penalty
    )
    match_score = round(max(0, min(100, match_score)), 1)

    return Scoring(
        match_score=match_score,
        primary_score=round(primary_score, 1),
        secondary_score=round(secondary_score, 1),
        experience_score=round(experience_score, 1),
        certification_score=round(certification_score, 1),
        risk_penalty=round(risk_penalty, 1),
    )


def get_rejection_reasons(skills_matched: SkillsMatched, total_exp: float, jd: dict) -> list[str]:
    """Generate explicit rejection reasons."""
    reasons = []

    # Check primary skills — if less than half matched, flag it
    primary_matched = sum(1 for v in skills_matched.primary.values() if v)
    primary_total = len(skills_matched.primary)
    if primary_total > 0 and primary_matched < primary_total * 0.5:
        missing = [s for s, v in skills_matched.primary.items() if not v]
        for skill in missing[:3]:  # Report up to 3
            reasons.append(f"Missing primary skill: {skill}")

    # Check minimum experience
    min_exp = jd.get("min_experience_years", 0)
    if min_exp > 0 and total_exp < min_exp:
        reasons.append(f"Insufficient experience: {total_exp} years (required: {min_exp})")

    return reasons


def classify_candidate(match_score: float, rejection_reasons: list[str], jd: dict) -> str:
    """Determine classification folder based on score and rejections.
    
    Returns: 'selected', 'rejected', or 'need-review'
    """
    thresholds = jd.get("thresholds", {})
    selected_threshold = thresholds.get("selected", 70)
    review_threshold = thresholds.get("need_review", 50)

    if match_score >= selected_threshold:
        return "selected"
    elif match_score >= review_threshold:
        return "need-review"
    else:
        return "rejected"
