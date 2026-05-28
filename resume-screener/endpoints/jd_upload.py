"""POST /api/jd — Upload and parse a Job Description."""

import uuid
import azure.functions as func
import json
from datetime import datetime

from processing.text_extractor import extract_text
from processing.jd_parser import parse_jd
from storage.blob_client import upload_jd_file
from storage.cosmos_client import upsert_jd, get_jd, list_jds
from models.jd_model import JobDescription, SkillsConfig, ScoringWeights, Thresholds
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def handle_jd_upload(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/jd — Upload a JD file (PDF/DOCX) or raw JSON text.
    
    Process:
    1. Extract text from file if uploaded
    2. LLM call to extract structured criteria
    3. Store original file in Blob
    4. Save structured JD to Cosmos
    5. Return jd_id + parsed criteria
    """
    trace_id = f"jd_{uuid.uuid4().hex[:8]}"

    try:
        jd_text = None
        file_name = None
        file_bytes = None

        # Check for file upload (multipart)
        files = req.files
        if files:
            for name, file_storage in files.items():
                file_bytes = file_storage.read()
                file_name = file_storage.filename
                break

            if file_bytes and file_name:
                # Validate file size
                if len(file_bytes) > 10 * 1024 * 1024:
                    return func.HttpResponse(
                        json.dumps({"error": "File size exceeds 10MB limit"}),
                        status_code=400,
                        mimetype="application/json",
                    )
                # Extract text
                jd_text = extract_text(file_bytes, file_name)
        else:
            # Check for JSON body with text
            try:
                body = req.get_json()
                jd_text = body.get("text", "")
            except ValueError:
                pass

        if not jd_text or not jd_text.strip():
            return func.HttpResponse(
                json.dumps({"error": "No JD content provided. Upload a file or send {\"text\": \"...\"}"}),
                status_code=400,
                mimetype="application/json",
            )

        # Parse JD using LLM
        parsed = parse_jd(jd_text, trace_id=trace_id)
        if parsed is None:
            return func.HttpResponse(
                json.dumps({"error": "Failed to parse JD content. Please try again."}),
                status_code=500,
                mimetype="application/json",
            )

        # Build JD model
        jd_id = str(uuid.uuid4())
        jd = JobDescription(
            id=jd_id,
            title=parsed.get("title", "Untitled Role"),
            domain=parsed.get("domain", "General"),
            min_experience_years=parsed.get("min_experience_years", 0),
            skills=SkillsConfig(**parsed.get("skills", {})),
            certifications_preferred=parsed.get("certifications_preferred", []),
            scoring_weights=ScoringWeights(),
            thresholds=Thresholds(),
            raw_text=jd_text[:5000],  # Store first 5000 chars for reference
        )

        # Upload original file to Blob (if file was uploaded)
        if file_bytes and file_name:
            upload_jd_file(file_bytes, f"{jd_id}_{file_name}")

        # Save to Cosmos
        upsert_jd(jd.to_cosmos_dict())

        log_with_context(logger, "INFO", f"JD processed: {jd.title}",
                        trace_id=trace_id, stage="jd_upload")

        return func.HttpResponse(
            json.dumps({
                "jd_id": jd_id,
                "title": jd.title,
                "parsed_criteria": {
                    "domain": jd.domain,
                    "min_experience_years": jd.min_experience_years,
                    "skills": jd.skills.model_dump(),
                    "certifications_preferred": jd.certifications_preferred,
                    "scoring_weights": jd.scoring_weights.model_dump(),
                    "thresholds": jd.thresholds.model_dump(),
                },
                "message": "JD processed successfully",
            }),
            status_code=201,
            mimetype="application/json",
        )

    except Exception as e:
        log_with_context(logger, "ERROR", f"JD upload failed: {e}",
                        trace_id=trace_id, stage="jd_upload")
        return func.HttpResponse(
            json.dumps({"error": f"Internal error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )


def handle_get_jds(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd — List all active JDs."""
    try:
        jds = list_jds()
        # Return summary (exclude raw_text for brevity)
        result = []
        for jd in jds:
            result.append({
                "id": jd.get("id"),
                "title": jd.get("title"),
                "domain": jd.get("domain"),
                "uploaded_at": jd.get("uploaded_at"),
                "min_experience_years": jd.get("min_experience_years"),
                "skills": jd.get("skills"),
            })
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


def handle_get_jd_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd/{jd_id} — Get a specific JD's criteria."""
    jd_id = req.route_params.get("jd_id")
    if not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "jd_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    jd = get_jd(jd_id)
    if not jd:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    # Remove Cosmos metadata
    jd.pop("_rid", None)
    jd.pop("_self", None)
    jd.pop("_etag", None)
    jd.pop("_attachments", None)
    jd.pop("_ts", None)

    return func.HttpResponse(
        json.dumps(jd),
        status_code=200,
        mimetype="application/json",
    )
