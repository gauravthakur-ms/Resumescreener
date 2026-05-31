"""Recommendation engine — maps scores and flags to hiring recommendations."""


def get_recommendation(match_score: float, risk_flags: list[str], rejection_reasons: list[str]) -> str:
    """Determine hiring recommendation based on score and risk analysis.
    
    | Recommendation | Condition |
    |----------------|-----------|
    | Strong Hire    | score >= 85 AND no risk flags |
    | Hire           | score 70-84 AND <= 1 risk flag |
    | Consider       | score 50-69 OR has risk flags |
    | Reject         | score < 50 |
    """
    if match_score < 50:
        return "Reject"

    if match_score >= 85 and len(risk_flags) == 0:
        return "Strong Hire"

    if match_score >= 70 and len(risk_flags) <= 1:
        return "Hire"

    if match_score >= 50:
        return "Consider"

    return "Reject"


def get_screening_status(recommendation: str) -> str:
    """Map recommendation to OK/NOK screening status."""
    if recommendation in ("Strong Hire", "Hire"):
        return "OK"
    elif recommendation == "Consider":
        return "REVIEW"
    else:
        return "NOK"
