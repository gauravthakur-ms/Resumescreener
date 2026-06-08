"""POST /api/jd — Upload and parse a Job Description."""

import uuid
import azure.functions as func
import json
from datetime import datetime

from processing.text_extractor import extract_text
from processing.jd_parser import parse_jd
from storage.blob_client import upload_jd_file
from storage.cosmos_client import upsert_jd, get_jd, list_jds, delete_jd
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
        project_id = ""
        rr_id = ""
        user_title = ""

        # Check for file upload (multipart)
        files = req.files
        if files:
            for name, file_storage in files.items():
                file_bytes = file_storage.read()
                file_name = file_storage.filename
                break

            # Extract project_id, rr_id, and title from form params for file uploads
            project_id = req.params.get("project_id", "") or req.form.get("project_id", "")
            rr_id = req.params.get("rr_id", "") or req.form.get("rr_id", "")
            user_title = (req.params.get("title", "") or req.form.get("title", "")).strip()

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
                project_id = body.get("project_id", "")
                rr_id = body.get("rr_id", "")
                user_title = body.get("title", "").strip()
            except ValueError:
                pass

        if not rr_id.strip():
            return func.HttpResponse(
                json.dumps({"error": "RR ID is required"}),
                status_code=400,
                mimetype="application/json",
            )

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

        # Build JD model — user-entered title takes priority over LLM-extracted
        jd_id = str(uuid.uuid4())
        final_title = user_title if user_title else parsed.get("title", "Untitled Role")
        jd = JobDescription(
            id=jd_id,
            title=final_title,
            rr_id=rr_id.strip(),
            project_id=project_id,
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
                "rr_id": jd.get("rr_id", ""),
                "project_id": jd.get("project_id", ""),
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


def handle_delete_jd(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/jd/{jd_id} — Delete a specific JD."""
    jd_id = req.route_params.get("jd_id")
    if not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "jd_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    deleted = delete_jd(jd_id)
    if not deleted:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    logger.info(f"Deleted JD: {jd_id}")
    return func.HttpResponse(
        json.dumps({"message": f"JD deleted successfully", "id": jd_id}),
        status_code=200,
        mimetype="application/json",
    )


def handle_update_jd(req: func.HttpRequest) -> func.HttpResponse:
    """PUT /api/jd/{jd_id} — Update an existing JD's fields."""
    jd_id = req.route_params.get("jd_id")
    if not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "jd_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    existing = get_jd(jd_id)
    if not existing:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json",
        )

    # Update allowed fields
    updatable = ["title", "rr_id", "project_id", "domain", "min_experience_years", "skills",
                 "certifications_preferred", "scoring_weights", "thresholds", "raw_text"]
    for field in updatable:
        if field in body:
            existing[field] = body[field]

    upsert_jd(existing)
    logger.info(f"Updated JD: {jd_id}")

    # Remove Cosmos metadata before returning
    for key in ["_rid", "_self", "_etag", "_attachments", "_ts"]:
        existing.pop(key, None)

    return func.HttpResponse(
        json.dumps(existing),
        status_code=200,
        mimetype="application/json",
    )


def handle_update_jd_text(req: func.HttpRequest) -> func.HttpResponse:
    """PUT /api/jd/{jd_id}/text — Update a JD by re-parsing raw text via LLM."""
    jd_id = req.route_params.get("jd_id")
    if not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "jd_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    existing = get_jd(jd_id)
    if not existing:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json",
        )

    raw_text = body.get("raw_text", "").strip()
    if not raw_text:
        return func.HttpResponse(
            json.dumps({"error": "raw_text is required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        trace_id = f"jd_reparse_{uuid.uuid4().hex[:8]}"
        parsed = parse_jd(raw_text, trace_id=trace_id)

        if not parsed:
            return func.HttpResponse(
                json.dumps({"error": "Failed to parse JD text"}),
                status_code=500,
                mimetype="application/json",
            )

        # Update fields from parsed output
        existing["title"] = body.get("title") or parsed.get("title", existing.get("title", "Untitled Role"))
        existing["domain"] = parsed.get("domain", existing.get("domain", "General"))
        existing["min_experience_years"] = parsed.get("min_experience_years", existing.get("min_experience_years", 0))
        existing["skills"] = parsed.get("skills", existing.get("skills", {}))
        existing["certifications_preferred"] = parsed.get("certifications_preferred", existing.get("certifications_preferred", []))
        existing["raw_text"] = raw_text[:5000]

        # Update metadata fields if provided
        if "rr_id" in body:
            existing["rr_id"] = body["rr_id"].strip()
        if "project_id" in body:
            existing["project_id"] = body["project_id"].strip()

        upsert_jd(existing)
        logger.info(f"Updated JD via text reparse: {jd_id}")

        # Remove Cosmos metadata before returning
        for key in ["_rid", "_self", "_etag", "_attachments", "_ts"]:
            existing.pop(key, None)

        return func.HttpResponse(
            json.dumps(existing),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"JD text reparse failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"Re-parse failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )
