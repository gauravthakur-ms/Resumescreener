"""Skills normalization using alias map from config."""

from config import SKILLS_ALIAS_MAP


def normalize_skill(skill: str) -> str:
    """Normalize a skill name using the alias map.
    
    Returns the canonical name if found, otherwise returns the original
    with title case applied.
    """
    if not skill:
        return skill
    lower = skill.strip().lower()
    return SKILLS_ALIAS_MAP.get(lower, skill.strip())


def normalize_skill_list(skills: list[str]) -> list[str]:
    """Normalize a list of skill names, removing duplicates."""
    seen = set()
    normalized = []
    for skill in skills:
        canonical = normalize_skill(skill)
        if canonical.lower() not in seen:
            seen.add(canonical.lower())
            normalized.append(canonical)
    return normalized


def skill_matches(candidate_skill: str, jd_skill: str) -> bool:
    """Check if a candidate skill matches a JD skill (case-insensitive, alias-aware)."""
    norm_candidate = normalize_skill(candidate_skill).lower()
    norm_jd = normalize_skill(jd_skill).lower()
    # Exact match
    if norm_candidate == norm_jd:
        return True
    # Substring match (e.g., "Android Development" matches "Android")
    if norm_jd in norm_candidate or norm_candidate in norm_jd:
        return True
    return False


def match_skills_against_jd(candidate_skills: list[str], jd_skills: list[str]) -> dict[str, bool]:
    """Match candidate skills against a list of JD skills.
    
    Returns a dict mapping each JD skill to whether it was matched.
    """
    result = {}
    for jd_skill in jd_skills:
        matched = any(skill_matches(cs, jd_skill) for cs in candidate_skills)
        result[jd_skill] = matched
    return result
