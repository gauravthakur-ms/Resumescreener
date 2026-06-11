"""Queue-triggered processor for resume conversion — extracts data and generates DOCX."""

import json
import uuid
from datetime import datetime

from processing.text_extractor import extract_text
from processing.conversion_extractor import extract_for_conversion
from processing.docx_generator import generate_conversion_docx
from storage.blob_client import download_resume, upload_export
from storage.cosmos_client import get_conversion, upsert_conversion
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def process_conversion_message(message_body: str):
    """Process a single resume conversion from a queue message.

    Steps:
    1. Download resume from blob
    2. Extract text
    3. LLM extraction for template mapping
    4. Generate DOCX
    5. Upload generated DOCX to blob
    6. Update conversion record in Cosmos
    """
    try:
        msg = json.loads(message_body)
    except json.JSONDecodeError as e:
        log_with_context(logger, "ERROR", f"Invalid conversion queue message: {e}",
                        stage="conversion_parse")
        return

    conversion_id = msg["conversion_id"]
    user_id = msg["user_id"]
    blob_path = msg["blob_path"]
    file_name = msg["file_name"]
    trace_id = f"conv_{conversion_id[:8]}"

    log_with_context(logger, "INFO", f"Conversion started: {file_name}",
                    trace_id=trace_id, stage="conversion_start")

    # Update status to processing
    conversion = get_conversion(conversion_id, user_id)
    if not conversion:
        log_with_context(logger, "ERROR", f"Conversion record not found: {conversion_id}",
                        trace_id=trace_id, stage="conversion_lookup")
        return

    conversion["status"] = "processing"
    upsert_conversion(conversion)

    try:
        # Step 1: Download resume
        file_bytes = download_resume(blob_path)
        if not file_bytes:
            raise ValueError("Failed to download resume from blob")

        # Step 2: Extract text
        resume_text = extract_text(file_bytes, file_name)
        if not resume_text or not resume_text.strip():
            raise ValueError("Failed to extract text from resume (empty result)")

        # Step 3: LLM extraction
        extracted, usage = extract_for_conversion(resume_text, trace_id=trace_id)
        if not extracted:
            raise ValueError("LLM extraction failed — no structured data returned")

        # Step 4: Update conversion record with extracted data
        conversion["personal"] = extracted.get("personal", {})
        conversion["experience_summary"] = extracted.get("experience_summary", [])
        conversion["skills_summary"] = extracted.get("skills_summary", {})
        conversion["projects"] = extracted.get("projects", [])
        conversion["other_experience"] = extracted.get("other_experience", [])
        conversion["education"] = extracted.get("education", [])
        conversion["certifications"] = extracted.get("certifications", [])

        # Step 5: Generate DOCX
        docx_bytes = generate_conversion_docx(extracted)

        # Step 6: Upload generated DOCX to blob
        output_file_name = f"conversions/{conversion_id}/{_safe_filename(file_name)}_LTM.docx"
        upload_export(docx_bytes, output_file_name)

        # Step 7: Update conversion record
        conversion["generated_file_path"] = output_file_name
        conversion["status"] = "completed"
        upsert_conversion(conversion)

        log_with_context(logger, "INFO", f"Conversion completed: {file_name}",
                        trace_id=trace_id, stage="conversion_complete")

    except Exception as e:
        log_with_context(logger, "ERROR", f"Conversion failed: {e}",
                        trace_id=trace_id, stage="conversion_error")
        conversion["status"] = "failed"
        conversion["error_message"] = str(e)
        upsert_conversion(conversion)


def _safe_filename(name: str) -> str:
    """Remove extension and sanitize filename for output."""
    base = name.rsplit(".", 1)[0] if "." in name else name
    # Replace unsafe chars
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in base).strip()
