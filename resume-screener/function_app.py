"""Azure Function App entry point — registers all HTTP routes and queue trigger."""

import sys
import os
import json
import base64

import azure.functions as func

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from endpoints.jd_upload import handle_jd_upload, handle_get_jds, handle_get_jd_by_id, handle_delete_jd, handle_update_jd, handle_update_jd_text
from endpoints.resume_upload import handle_resume_upload
from endpoints.batch_status import handle_batch_status, handle_get_batches, handle_delete_batch
from endpoints.results import handle_batch_results, handle_batch_export
from endpoints.screened_resumes import handle_get_candidates_by_jd, handle_delete_candidate, handle_jd_export
from processing.queue_processor import process_resume_message
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

app = func.FunctionApp()


# ============================================================
# HTTP Endpoints
# ============================================================

@app.route(route="jd", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def post_jd(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/jd — Upload and parse a Job Description."""
    return handle_jd_upload(req)


@app.route(route="jd", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_jds(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd — List all active JDs."""
    return handle_get_jds(req)


@app.route(route="jd/{jd_id}", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_jd_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd/{jd_id} — Get a specific JD."""
    return handle_get_jd_by_id(req)


@app.route(route="jd/{jd_id}", methods=["DELETE"], auth_level=func.AuthLevel.ANONYMOUS)
def delete_jd_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/jd/{jd_id} — Delete a specific JD."""
    return handle_delete_jd(req)


@app.route(route="jd/{jd_id}", methods=["PUT"], auth_level=func.AuthLevel.ANONYMOUS)
def update_jd_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """PUT /api/jd/{jd_id} — Update a specific JD."""
    return handle_update_jd(req)


@app.route(route="jd/{jd_id}/text", methods=["PUT"], auth_level=func.AuthLevel.ANONYMOUS)
def update_jd_text(req: func.HttpRequest) -> func.HttpResponse:
    """PUT /api/jd/{jd_id}/text — Update a JD by re-parsing raw text."""
    return handle_update_jd_text(req)


@app.route(route="resume/upload", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def post_resume_upload(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/resume/upload?jd_id={jd_id} — Upload resumes for screening."""
    return handle_resume_upload(req)


@app.route(route="batch/{batch_id}/status", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_batch_status(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batch/{batch_id}/status — Check batch progress."""
    return handle_batch_status(req)


@app.route(route="batches", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_batches(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batches — List recent batches."""
    return handle_get_batches(req)


@app.route(route="batch/{batch_id}", methods=["DELETE"], auth_level=func.AuthLevel.ANONYMOUS)
def delete_batch_by_id(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/batch/{batch_id} — Delete a specific batch."""
    return handle_delete_batch(req)


@app.route(route="batch/{batch_id}/results", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_batch_results(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batch/{batch_id}/results — Get ranked results."""
    return handle_batch_results(req)


@app.route(route="batch/{batch_id}/export", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def get_batch_export(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/batch/{batch_id}/export — Download Excel export for filtered candidates."""
    return handle_batch_export(req)


@app.route(route="jd/{jd_id}/candidates", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def get_jd_candidates(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd/{jd_id}/candidates — List screened candidates for a JD."""
    return handle_get_candidates_by_jd(req)


@app.route(route="jd/{jd_id}/export", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def get_jd_export(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/jd/{jd_id}/export — Export filtered screened candidates for a JD as Excel."""
    return handle_jd_export(req)


@app.route(route="candidate/{candidate_id}", methods=["DELETE"], auth_level=func.AuthLevel.ANONYMOUS)
def delete_candidate(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/candidate/{candidate_id}?jd_id={jd_id} — Delete a screened resume."""
    return handle_delete_candidate(req)


@app.route(route="candidate/{candidate_id}/download", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def download_candidate_resume(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/candidate/{candidate_id}/download?jd_id={jd_id} — Download original resume file."""
    from endpoints.resume_download import handle_resume_download
    return handle_resume_download(req)


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/health — Service health check."""
    from config import (
        AZURE_OPENAI_ENDPOINT,
        AZURE_COSMOS_ENDPOINT,
        AZURE_STORAGE_CONNECTION_STRING,
    )
    status = {
        "status": "healthy",
        "services": {
            "azure_openai": "configured" if AZURE_OPENAI_ENDPOINT else "NOT configured",
            "cosmos_db": "configured" if AZURE_COSMOS_ENDPOINT else "NOT configured",
            "blob_storage": "configured" if AZURE_STORAGE_CONNECTION_STRING else "NOT configured",
        },
    }
    return func.HttpResponse(
        json.dumps(status),
        status_code=200,
        mimetype="application/json",
    )


# ============================================================
# Queue Trigger
# ============================================================

@app.queue_trigger(
    arg_name="msg",
    queue_name="resume-processing-queue",
    connection="AzureWebJobsStorage",
)
def process_resume_queue(msg: func.QueueMessage):
    """Queue trigger — processes one resume per message."""
    try:
        # Azure Functions may pass base64-encoded or raw message
        raw = msg.get_body().decode("utf-8")
        try:
            # Try to decode base64 first
            decoded = base64.b64decode(raw).decode("utf-8")
            message_body = decoded
        except Exception:
            message_body = raw

        log_with_context(logger, "INFO", f"Queue message received",
                        stage="queue_trigger")
        process_resume_message(message_body)

    except Exception as e:
        log_with_context(logger, "ERROR", f"Queue processing failed: {e}",
                        stage="queue_trigger")
        # Don't re-raise: failures are already recorded in batch counters.
        # Re-raising causes queue retry which inflates failure counts.
