"""LLM-based extraction for resume conversion to LTM standardized format."""

from processing.llm_client import call_llm, parse_llm_json
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

CONVERSION_EXTRACTION_PROMPT = """You are an expert resume data extractor. Extract ALL information from the given resume text and structure it into the following JSON format. This data will be used to generate a standardized organizational resume.

IMPORTANT RULES:
- Extract information exactly as presented in the resume
- If a field is not found, use "NDATA" for strings or empty arrays for lists
- For PS ID, look for patterns like "PS Id", "PS ID", "Employee ID", "Emp ID", or any numeric ID near the person's name
- Experience summary should be concise bullet points describing key competencies
- Each project must have clear start/end dates, description, and role contributions
- Technologies should be comma-separated strings
- Dates should be in format like "June 2024", "March 2025", etc.

Return ONLY valid JSON matching this exact schema:

{
  "personal": {
    "name": "Full Name",
    "ps_id": "Employee/PS ID number or NDATA",
    "mobile": "Phone number or NDATA",
    "email": "Email address or NDATA"
  },
  "experience_summary": [
    "Bullet point 1 describing a key competency or experience area",
    "Bullet point 2...",
    "..."
  ],
  "skills_summary": {
    "domain": "Primary domain (e.g., Banking, Healthcare, Retail)",
    "programming_languages": "Comma-separated languages (e.g., Python, SQL, JavaScript, TypeScript, React, Angular)",
    "tools": "Comma-separated tools (e.g., Git, VS Code, GitHub, Jupyter Notebook, ADO, AWS)",
    "project_overview": "Brief comma-separated project types (e.g., Data migration, Gen-AI tools, cloud-based applications)"
  },
  "projects": [
    {
      "project_name": "Project Name",
      "team_size": "Number as string (e.g., '5')",
      "start_date": "Month Year (e.g., July 2025)",
      "end_date": "Month Year (e.g., Feb 2026)",
      "description": "1-3 sentence project description",
      "role_contributions": [
        "Contribution bullet 1",
        "Contribution bullet 2"
      ],
      "technologies": "Comma-separated (e.g., Python, SQL, VS code, Git)"
    }
  ],
  "other_experience": [
    {
      "title": "Type (e.g., Capstone Project, Internship, Personal Project)",
      "project_name": "Project name",
      "start_date": "Start date",
      "end_date": "End date",
      "role_contributions": ["Contribution 1", "Contribution 2"],
      "technologies": "Comma-separated tools"
    }
  ],
  "education": [
    {
      "degree": "Full degree name (e.g., B. TECH Information Technology)",
      "institution": "University/College name",
      "year_range": "Start-End years (e.g., 2019-2023)",
      "percentage": "Percentage or CGPA (e.g., 79.3%)"
    }
  ],
  "certifications": [
    {
      "name": "Certification name (e.g., AWS Cloud Practitioner)",
      "validity": "Validity period (e.g., June 2025 - June 2028) or empty string if not specified"
    }
  ]
}

Order projects by most recent first (latest start_date first).
Include ALL projects found in the resume - do not skip any.
"""


def extract_for_conversion(resume_text: str, trace_id: str = "") -> tuple[dict | None, dict]:
    """Extract structured data from resume text for LTM template conversion.

    Returns: (extracted_data_dict, token_usage_dict) — extracted_data_dict is None on failure.
    """
    response_text, usage = call_llm(
        system_prompt=CONVERSION_EXTRACTION_PROMPT,
        user_content=resume_text,
        trace_id=trace_id,
        stage="conversion_extraction",
    )

    parsed = parse_llm_json(response_text, trace_id=trace_id)
    if parsed is None:
        log_with_context(logger, "ERROR", "Failed to parse conversion extraction response",
                        trace_id=trace_id, stage="conversion_extraction")
        return None, usage

    return parsed, usage
