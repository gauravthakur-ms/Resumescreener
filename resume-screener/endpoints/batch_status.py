"""GET /api/batch/{batch_id}/status — Check batch processing progress.
   GET /api/batches — List recent batches."""

import json
import azure.functions as func

from storage.cosmos_client import get_batch, list_batches, delete_batch
from auth.token_validator import get_user_id
from utils.logger import get_logger

logger = get_logger(__name__)


def handle_batch_status(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batch/{batch_id}/status — Poll progress of a batch upload."""
    batch_id = req.route_params.get("batch_id")
    if not batch_id:
        return func.HttpResponse(
            json.dumps({"error": "batch_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    batch = get_batch(batch_id)
    if not batch:
        return func.HttpResponse(
            json.dumps({"error": f"Batch not found: {batch_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    # Verify ownership
    user_id = get_user_id(req)
    if batch.get("user_id") and batch["user_id"] != user_id:
        return func.HttpResponse(
            json.dumps({"error": "Access denied"}),
            status_code=403,
            mimetype="application/json",
        )

    total = batch.get("total", 0)
    processed = batch.get("processed", 0)
    failed = batch.get("failed", 0)
    duplicates = batch.get("duplicates", 0)
    done = processed + failed + duplicates
    pending = max(total - done, 0)
    progress_pct = min(round((done / total) * 100, 1), 100) if total > 0 else 0

    response = {
        "batch_id": batch_id,
        "jd_id": batch.get("jd_id"),
        "jd_title": batch.get("jd_title", ""),
        "status": batch.get("status"),
        "total": total,
        "processed": processed,
        "failed": failed,
        "duplicates": duplicates,
        "pending": pending,
        "progress_pct": progress_pct,
        "uploaded_at": batch.get("uploaded_at"),
        "completed_at": batch.get("completed_at"),
    }

    return func.HttpResponse(
        json.dumps(response),
        status_code=200,
        mimetype="application/json",
    )


def handle_get_batches(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batches — List recent batches for the current user."""
    try:
        user_id = get_user_id(req)
        batches = list_batches(limit=50, user_id=user_id)
        result = []
        for b in batches:
            total = b.get("total", 0)
            processed = b.get("processed", 0)
            failed = b.get("failed", 0)
            duplicates = b.get("duplicates", 0)
            result.append({
                "id": b.get("id"),
                "jd_id": b.get("jd_id"),
                "jd_title": b.get("jd_title", ""),
                "status": b.get("status"),
                "total": total,
                "processed": processed,
                "failed": failed,
                "duplicates": duplicates,
                "uploaded_at": b.get("uploaded_at"),
                "completed_at": b.get("completed_at"),
            })
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        logger.error(f"Error listing batches: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to list batches"}),
            status_code=500,
            mimetype="application/json",
        )


def handle_delete_batch(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/batch/{batch_id} — Delete a specific batch."""
    batch_id = req.route_params.get("batch_id")
    if not batch_id:
        return func.HttpResponse(
            json.dumps({"error": "batch_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    # Verify ownership before deleting
    batch = get_batch(batch_id)
    if not batch:
        return func.HttpResponse(
            json.dumps({"error": f"Batch not found: {batch_id}"}),
            status_code=404,
            mimetype="application/json",
        )
    user_id = get_user_id(req)
    if batch.get("user_id") and batch["user_id"] != user_id:
        return func.HttpResponse(
            json.dumps({"error": "Access denied"}),
            status_code=403,
            mimetype="application/json",
        )

    deleted = delete_batch(batch_id)
    if not deleted:
        return func.HttpResponse(
            json.dumps({"error": f"Batch not found: {batch_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    logger.info(f"Deleted batch: {batch_id}")
    return func.HttpResponse(
        json.dumps({"message": "Batch deleted successfully", "id": batch_id}),
        status_code=200,
        mimetype="application/json",
    )
