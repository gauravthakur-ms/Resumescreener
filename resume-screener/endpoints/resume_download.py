"""GET /api/candidate/{candidate_id}/download — Download original resume file."""

import json
import azure.functions as func
from storage.cosmos_client import get_candidate
from storage.blob_client import download_resume
from utils.logger import get_logger

logger = get_logger(__name__)


def handle_resume_download(req: func.HttpRequest) -> func.HttpResponse:
    """Download the original resume file for a candidate."""
    candidate_id = req.route_params.get("candidate_id")
    jd_id = req.params.get("jd_id")

    if not candidate_id or not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "candidate_id and jd_id are required"}),
            status_code=400,
            mimetype="application/json",
        )

    candidate = get_candidate(candidate_id, jd_id)
    if not candidate:
        return func.HttpResponse(
            json.dumps({"error": "Candidate not found"}),
            status_code=404,
            mimetype="application/json",
        )

    batch_id = candidate.get("batch_id", "")
    file_name = candidate.get("file_name", "")

    if not batch_id or not file_name:
        return func.HttpResponse(
            json.dumps({"error": "Resume file reference not found"}),
            status_code=404,
            mimetype="application/json",
        )

    try:
        blob_path = f"raw/{batch_id}/{file_name}"
        file_bytes = download_resume(blob_path)

        # Determine content type
        lower_name = file_name.lower()
        if lower_name.endswith(".pdf"):
            content_type = "application/pdf"
        elif lower_name.endswith(".docx"):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif lower_name.endswith(".doc"):
            content_type = "application/msword"
        else:
            content_type = "application/octet-stream"

        return func.HttpResponse(
            body=file_bytes,
            status_code=200,
            mimetype=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file_name}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    except Exception as e:
        logger.error(f"Resume download failed for {candidate_id}: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"Download failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )
