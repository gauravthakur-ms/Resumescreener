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
) -> SkillsMatched:
    """Match candidate skills against JD categories."""
    # Collect all skills from work experience
    all_candidate_skills = set()
    for entry in individual_exp:
        for skill in entry.get("skills_used", []):
            all_candidate_skills.add(skill)

    skills_config = jd.get("skills", {})
    candidate_skills_list = list(all_candidate_skills)

    matched = SkillsMatched(
        mandatory=match_skills_against_jd(candidate_skills_list, skills_config.get("mandatory", [])),
        primary=match_skills_against_jd(candidate_skills_list, skills_config.get("primary", [])),
        secondary=match_skills_against_jd(candidate_skills_list, skills_config.get("secondary", [])),
        good_to_have=match_skills_against_jd(candidate_skills_list, skills_config.get("good_to_have", [])),
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
        mandatory_score  = (matched / total) * weight * 100
        primary_score    = (matched / total) * weight * 100
        experience_score = min(actual / required, 1.0) * weight * 100
        cert_score       = (matched / max(total, 1)) * weight * 100
        secondary_score  = (matched / total) * weight * 100
        risk_penalty     = -5 per risk flag (max -15)
        match_score      = sum, clamped to [0, 100]
    """
    weights = jd.get("scoring_weights", {})
    w_mandatory = weights.get("mandatory_skills", 0.40)
    w_primary = weights.get("primary_skills", 0.25)
    w_experience = weights.get("experience", 0.20)
    w_certs = weights.get("certifications", 0.10)
    w_secondary = weights.get("secondary_skills", 0.05)

    # Mandatory
    mandatory_matched = sum(1 for v in skills_matched.mandatory.values() if v)
    mandatory_total = max(len(skills_matched.mandatory), 1)
    mandatory_score = (mandatory_matched / mandatory_total) * w_mandatory * 100

    # Primary
    primary_matched = sum(1 for v in skills_matched.primary.values() if v)
    primary_total = max(len(skills_matched.primary), 1)
    primary_score = (primary_matched / primary_total) * w_primary * 100

    # Experience
    min_exp = jd.get("min_experience_years", 1)
    exp_ratio = min(total_exp / max(min_exp, 1), 1.0)
    experience_score = exp_ratio * w_experience * 100

    # Certifications
    certs_preferred = jd.get("certifications_preferred", [])
    certs_lower = {c.lower() for c in certifications_found}
    certs_matched = sum(1 for c in certs_preferred if c.lower() in certs_lower)
    certs_total = max(len(certs_preferred), 1)
    certification_score = (certs_matched / certs_total) * w_certs * 100

    # Secondary
    secondary_matched = sum(1 for v in skills_matched.secondary.values() if v)
    secondary_total = max(len(skills_matched.secondary), 1)
    secondary_score = (secondary_matched / secondary_total) * w_secondary * 100

    # Risk penalty
    risk_penalty = min(len(risk_flags) * -5.0, 0)  # Max -15

    # Total
    match_score = (
        mandatory_score + primary_score + experience_score +
        certification_score + secondary_score + risk_penalty
    )
    match_score = round(max(0, min(100, match_score)), 1)

    return Scoring(
        match_score=match_score,
        mandatory_score=round(mandatory_score, 1),
        primary_score=round(primary_score, 1),
        experience_score=round(experience_score, 1),
        certification_score=round(certification_score, 1),
        secondary_score=round(secondary_score, 1),
        risk_penalty=round(risk_penalty, 1),
    )


def get_rejection_reasons(skills_matched: SkillsMatched, total_exp: float, jd: dict) -> list[str]:
    """Generate explicit rejection reasons."""
    reasons = []

    # Check mandatory skills
    for skill, matched in skills_matched.mandatory.items():
        if not matched:
            reasons.append(f"Missing mandatory skill: {skill}")

    # Check minimum experience
    min_exp = jd.get("min_experience_years", 0)
    if min_exp > 0 and total_exp < min_exp:
        reasons.append(f"Insufficient experience: {total_exp} years (required: {min_exp})")

    return reasons


def classify_candidate(match_score: float, rejection_reasons: list[str], jd: dict) -> str:
    """Determine classification folder based on score and rejections.
    
    Returns: 'selected', 'rejected', or 'need-review'
    """
    # Any mandatory miss = rejected regardless of score
    if any("Missing mandatory skill" in r for r in rejection_reasons):
        return "rejected"

    thresholds = jd.get("thresholds", {})
    selected_threshold = thresholds.get("selected", 70)
    review_threshold = thresholds.get("need_review", 50)

    if match_score >= selected_threshold:
        return "selected"
    elif match_score >= review_threshold:
        return "need-review"
    else:
        return "rejected"
