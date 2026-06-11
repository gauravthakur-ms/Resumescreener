"""Resume Conversion endpoints — upload, status, preview, edit, download, list, delete."""

import uuid
import json
import azure.functions as func

from storage.blob_client import upload_resume, download_resume
from storage.queue_client import enqueue_conversion
from storage.cosmos_client import (
    upsert_conversion, get_conversion, list_conversions, delete_conversion,
)
from processing.docx_generator import generate_conversion_docx
from processing.text_extractor import extract_text
from auth.token_validator import get_user_id
from models.conversion_model import ResumeConversion
from config import MAX_FILE_SIZE_MB
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = (".pdf", ".docx")


def handle_convert_upload(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/convert — Upload a resume for conversion to LTM format.

    Accepts a single file (PDF/DOCX). Creates a conversion record and enqueues for processing.
    Returns conversion_id (202 Accepted).
    """
    user_id = get_user_id(req)

    files = req.files
    if not files:
        return func.HttpResponse(
            json.dumps({"error": "No file uploaded. Send a resume file as multipart/form-data."}),
            status_code=400,
            mimetype="application/json",
        )

    # Get first file
    file_storage = None
    for name in files:
        file_storage = files[name]
        break

    if not file_storage:
        return func.HttpResponse(
            json.dumps({"error": "No file uploaded."}),
            status_code=400,
            mimetype="application/json",
        )

    file_name = file_storage.filename
    file_bytes = file_storage.read()

    # Validate extension
    if not file_name.lower().endswith(SUPPORTED_EXTENSIONS):
        return func.HttpResponse(
            json.dumps({"error": "Unsupported format. Only PDF and DOCX are supported."}),
            status_code=400,
            mimetype="application/json",
        )

    # Validate size
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        return func.HttpResponse(
            json.dumps({"error": f"File exceeds {MAX_FILE_SIZE_MB}MB limit."}),
            status_code=400,
            mimetype="application/json",
        )

    if len(file_bytes) == 0:
        return func.HttpResponse(
            json.dumps({"error": "Empty file."}),
            status_code=400,
            mimetype="application/json",
        )

    # Create conversion record
    conversion_id = str(uuid.uuid4())
    conversion = ResumeConversion(
        id=conversion_id,
        user_id=user_id,
        original_file_name=file_name,
        status="queued",
    )
    upsert_conversion(conversion.to_cosmos_dict())

    # Upload to blob
    blob_path = upload_resume(file_bytes, f"conversions/{conversion_id}", file_name)

    # Enqueue for async processing
    enqueue_conversion(
        conversion_id=conversion_id,
        user_id=user_id,
        blob_path=blob_path,
        file_name=file_name,
    )

    return func.HttpResponse(
        json.dumps({
            "conversion_id": conversion_id,
            "status": "queued",
            "message": "Resume uploaded. Conversion in progress.",
        }),
        status_code=202,
        mimetype="application/json",
    )


def handle_conversion_status(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/convert/{conversion_id}/status — Poll conversion progress."""
    conversion_id = req.route_params.get("conversion_id")
    user_id = get_user_id(req)

    if not conversion_id:
        return func.HttpResponse(
            json.dumps({"error": "conversion_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    conversion = get_conversion(conversion_id, user_id)
    if not conversion:
        return func.HttpResponse(
            json.dumps({"error": "Conversion not found"}),
            status_code=404,
            mimetype="application/json",
        )

    return func.HttpResponse(
        json.dumps({
            "conversion_id": conversion_id,
            "status": conversion.get("status"),
            "error_message": conversion.get("error_message"),
            "created_at": conversion.get("created_at"),
            "original_file_name": conversion.get("original_file_name"),
        }),
        status_code=200,
        mimetype="application/json",
    )


def handle_get_conversion(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/convert/{conversion_id} — Get full extracted data for preview/editing."""
    conversion_id = req.route_params.get("conversion_id")
    user_id = get_user_id(req)

    if not conversion_id:
        return func.HttpResponse(
            json.dumps({"error": "conversion_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    conversion = get_conversion(conversion_id, user_id)
    if not conversion:
        return func.HttpResponse(
            json.dumps({"error": "Conversion not found"}),
            status_code=404,
            mimetype="application/json",
        )

    # Remove Cosmos metadata
    for key in ["_rid", "_self", "_etag", "_attachments", "_ts"]:
        conversion.pop(key, None)

    return func.HttpResponse(
        json.dumps(conversion),
        status_code=200,
        mimetype="application/json",
    )


def handle_update_conversion(req: func.HttpRequest) -> func.HttpResponse:
    """PUT /api/convert/{conversion_id} — Update extracted data and regenerate DOCX."""
    conversion_id = req.route_params.get("conversion_id")
    user_id = get_user_id(req)

    if not conversion_id:
        return func.HttpResponse(
            json.dumps({"error": "conversion_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    conversion = get_conversion(conversion_id, user_id)
    if not conversion:
        return func.HttpResponse(
            json.dumps({"error": "Conversion not found"}),
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

    # Update editable fields
    editable_fields = [
        "personal", "experience_summary", "skills_summary",
        "projects", "other_experience", "education", "certifications",
    ]
    for field in editable_fields:
        if field in body:
            conversion[field] = body[field]

    # Regenerate DOCX with updated data
    try:
        from storage.blob_client import upload_export
        docx_bytes = generate_conversion_docx(conversion)
        output_path = f"conversions/{conversion_id}/output_LTM.docx"
        upload_export(docx_bytes, output_path)
        conversion["generated_file_path"] = output_path
    except Exception as e:
        logger.error(f"DOCX regeneration failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"DOCX regeneration failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )

    upsert_conversion(conversion)

    # Clean response
    for key in ["_rid", "_self", "_etag", "_attachments", "_ts"]:
        conversion.pop(key, None)

    return func.HttpResponse(
        json.dumps(conversion),
        status_code=200,
        mimetype="application/json",
    )


def handle_conversion_download(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/convert/{conversion_id}/download — Download the generated DOCX."""
    conversion_id = req.route_params.get("conversion_id")
    user_id = get_user_id(req)

    if not conversion_id:
        return func.HttpResponse(
            json.dumps({"error": "conversion_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    conversion = get_conversion(conversion_id, user_id)
    if not conversion:
        return func.HttpResponse(
            json.dumps({"error": "Conversion not found"}),
            status_code=404,
            mimetype="application/json",
        )

    if conversion.get("status") != "completed":
        return func.HttpResponse(
            json.dumps({"error": "Conversion not yet completed", "status": conversion.get("status")}),
            status_code=409,
            mimetype="application/json",
        )

    file_path = conversion.get("generated_file_path")
    if not file_path:
        return func.HttpResponse(
            json.dumps({"error": "Generated file not found"}),
            status_code=404,
            mimetype="application/json",
        )

    try:
        from storage.blob_client import download_export
        file_bytes = download_export(file_path)

        # Build download filename
        original = conversion.get("original_file_name", "resume")
        base_name = original.rsplit(".", 1)[0] if "." in original else original
        download_name = f"{base_name}_LTM_Format.docx"

        return func.HttpResponse(
            body=file_bytes,
            status_code=200,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"Download failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )


def handle_list_conversions(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/conversions — List user's conversion history."""
    user_id = get_user_id(req)

    try:
        conversions = list_conversions(user_id)
        result = []
        for c in conversions:
            result.append({
                "id": c.get("id"),
                "original_file_name": c.get("original_file_name"),
                "status": c.get("status"),
                "created_at": c.get("created_at"),
                "personal_name": c.get("personal", {}).get("name", ""),
            })
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        logger.error(f"Error listing conversions: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to list conversions"}),
            status_code=500,
            mimetype="application/json",
        )


def handle_delete_conversion(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/convert/{conversion_id} — Delete a conversion record."""
    conversion_id = req.route_params.get("conversion_id")
    user_id = get_user_id(req)

    if not conversion_id:
        return func.HttpResponse(
            json.dumps({"error": "conversion_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    deleted = delete_conversion(conversion_id, user_id)
    if not deleted:
        return func.HttpResponse(
            json.dumps({"error": "Conversion not found"}),
            status_code=404,
            mimetype="application/json",
        )

    return func.HttpResponse(
        json.dumps({"message": "Conversion deleted", "id": conversion_id}),
        status_code=200,
        mimetype="application/json",
    )
