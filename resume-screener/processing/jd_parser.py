"""JD parser — extracts structured criteria from Job Description text using LLM."""

from processing.llm_client import call_llm, parse_llm_json
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

JD_EXTRACTION_PROMPT = """You are an expert HR analyst. Extract structured job criteria from the Job Description text below.

Extract the following:
1. Job Title
2. Domain (e.g., Cybersecurity, Banking, Telecom, Healthcare, IT, Data Science, DevOps, etc.)
3. Minimum experience required (in years, as a number)
4. Mandatory Skills — skills explicitly marked as required/must-have
5. Primary Skills — core skills strongly emphasized
6. Secondary Skills — skills mentioned but not critical
7. Good-to-Have Skills — nice-to-have/preferred skills
8. Preferred Certifications — any certifications mentioned

Rules:
- Classify skills carefully: mandatory = absolute requirement, primary = strongly preferred, secondary = useful, good_to_have = bonus
- If minimum experience is not explicitly stated, estimate from seniority level (Junior=1, Mid=3, Senior=5, Lead=8)
- Return only valid JSON. No explanation, no markdown, no code fences.
- If a field cannot be determined, use empty list [] or 0.

Output Format:
{
  "title": "...",
  "domain": "...",
  "min_experience_years": 3,
  "skills": {
    "mandatory": ["Skill1", "Skill2"],
    "primary": ["Skill3", "Skill4"],
    "secondary": ["Skill5"],
    "good_to_have": ["Skill6"]
  },
  "certifications_preferred": ["Cert1", "Cert2"]
}"""


def parse_jd(jd_text: str, trace_id: str = "") -> dict | None:
    """Parse a Job Description text into structured criteria.
    
    Returns parsed dict or None on failure.
    """
    response_text, usage = call_llm(
        system_prompt=JD_EXTRACTION_PROMPT,
        user_content=jd_text,
        trace_id=trace_id,
        stage="jd_parsing",
    )

    parsed = parse_llm_json(response_text, trace_id=trace_id)
    if parsed is None:
        log_with_context(logger, "ERROR", "Failed to parse JD extraction response",
                        trace_id=trace_id, stage="jd_parsing")
        return None

    # Ensure required structure
    if "skills" not in parsed:
        parsed["skills"] = {"mandatory": [], "primary": [], "secondary": [], "good_to_have": []}

    return parsed
