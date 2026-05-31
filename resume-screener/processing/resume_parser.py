"""Resume parser — single LLM call to extract all candidate fields."""

from datetime import datetime
from processing.llm_client import call_llm, parse_llm_json
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def _build_extraction_prompt(jd_skills: dict) -> str:
    """Build a dynamic extraction prompt based on JD skills."""
    all_skills = []
    for category in ["primary", "secondary"]:
        all_skills.extend(jd_skills.get(category, []))
    skills_list = ", ".join(all_skills) if all_skills else "General IT skills"

    current_month_year = datetime.now().strftime("%B%Y")

    return f"""You are an expert resume parser. Extract ALL of the following information from the resume text.

Current date reference: {current_month_year}

Extract these fields:

1. Personal Details:
   - name, email, phone, location, linkedin, current_organization

2. Work Experience (for EACH organization):
   - organization name
   - start_end: date range in format MMMYYYY-MMMYYYY (e.g., Jan2022-Mar2025)
     - Replace "Present", "Current", "Now", "Till Date" with {current_month_year}
     - If no dates found, use "NDATA"
   - duration_years: calculated duration as float
   - skills_used: list of skills used at that organization (from this list: {skills_list})

3. Certifications: list all professional certifications found

4. Domain Classification: identify primary domain (Cybersecurity, Banking, Telecom, Healthcare, IT, Data Science, DevOps, Education, Manufacturing, Retail, etc.)

5. Summary of Experience: 20-30 word summary from work experience (not from resume summary section)

6. Last Work Date: the end date of the most recent role in MMMYYYY format

7. Confidence Scores: rate your confidence for each major field extraction:
   - name_confidence, email_confidence, experience_years_confidence, skills_confidence
   - Values: "High", "Medium", "Low"

Rules:
- Extract skills ONLY from work experience descriptions, not from skills/summary sections for experience counting
- If a field cannot be found, use "NDATA" (never null or empty string)
- All dates must be in MMMYYYY format (e.g., Jan2023, Nov2021)
- Duration should be calculated as float years (e.g., 2.5)
- Return only valid JSON. No explanation, no markdown, no code fences.

Output Format:
{{
  "personal": {{
    "name": "...",
    "email": "...",
    "phone": "...",
    "location": "...",
    "linkedin": "...",
    "current_organization": "..."
  }},
  "experience": {{
    "last_work_date": "Mar2025",
    "summary": "...",
    "individual": [
      {{
        "organization": "Company Name",
        "start_end": "Jan2022-Mar2025",
        "duration_years": 3.2,
        "skills_used": ["Android", "Malware Analysis"]
      }}
    ]
  }},
  "certifications": ["GREM", "OSCP"],
  "domain_classification": "Cybersecurity",
  "confidence": {{
    "name_confidence": "High",
    "email_confidence": "High",
    "experience_years_confidence": "Medium",
    "skills_confidence": "High"
  }}
}}"""


def parse_resume(resume_text: str, jd_skills: dict, trace_id: str = "") -> tuple[dict | None, dict]:
    """Parse a resume using a single LLM call.
    
    Args:
        resume_text: The extracted resume text
        jd_skills: Skills dict from JD (mandatory, primary, secondary, good_to_have)
        trace_id: For logging
    
    Returns:
        tuple: (parsed_data_dict, token_usage_dict)
        parsed_data_dict is None on failure
    """
    prompt = _build_extraction_prompt(jd_skills)

    response_text, usage = call_llm(
        system_prompt=prompt,
        user_content=resume_text,
        trace_id=trace_id,
        stage="resume_parsing",
    )

    parsed = parse_llm_json(response_text, trace_id=trace_id)
    if parsed is None:
        log_with_context(logger, "ERROR", "Failed to parse resume extraction response",
                        trace_id=trace_id, stage="resume_parsing")
        return None, usage

    return parsed, usage
