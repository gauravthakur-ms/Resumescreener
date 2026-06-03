"""GET /api/batch/{batch_id}/results and /export — Retrieve and export candidate results."""

import json
import uuid
from datetime import datetime
import azure.functions as func

from storage.cosmos_client import get_batch, get_candidates_by_batch, get_jd
from storage.blob_client import upload_export, get_export_sas_url
from utils.excel_exporter import generate_excel_report
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def handle_batch_results(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batch/{batch_id}/results — Get ranked candidate results.
    
    Query params:
        top (int): Return only top N candidates (default: all)
        sort (str): Sort field — match_score, relevant_experience, recommendation
    """
    batch_id = req.route_params.get("batch_id")
    if not batch_id:
        return func.HttpResponse(
            json.dumps({"error": "batch_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    # Validate batch exists
    batch = get_batch(batch_id)
    if not batch:
        return func.HttpResponse(
            json.dumps({"error": f"Batch not found: {batch_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    # Parse query params
    top = req.params.get("top")
    top = int(top) if top and top.isdigit() else None
    sort_by = req.params.get("sort", "match_score")

    # Get candidates
    candidates = get_candidates_by_batch(batch_id, top=top, sort_by=sort_by)

    # Clean Cosmos metadata from results
    for c in candidates:
        c.pop("_rid", None)
        c.pop("_self", None)
        c.pop("_etag", None)
        c.pop("_attachments", None)
        c.pop("_ts", None)

    # Look up JD for certifications info
    jd_id = batch.get("jd_id")
    jd = get_jd(jd_id) if jd_id else None

    response = {
        "batch_id": batch_id,
        "jd_id": jd_id,
        "certifications_preferred": jd.get("certifications_preferred", []) if jd else [],
        "total_results": len(candidates),
        "sort_by": sort_by,
        "candidates": candidates,
    }

    return func.HttpResponse(
        json.dumps(response),
        status_code=200,
        mimetype="application/json",
    )


def handle_batch_export(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/batch/{batch_id}/export — Generate and return downloadable Excel.
    
    Process:
    1. Query all candidates for batch from Cosmos
    2. Generate Excel with 'All Candidates' and 'Top 10 Ranking' sheets
    3. Upload to Blob /exports/
    4. Return download URL (SAS URL, 1 hour expiry)
    """
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

    try:
        # Get all candidates
        candidates = get_candidates_by_batch(batch_id)

        if not candidates:
            return func.HttpResponse(
                json.dumps({"error": "No candidates found for this batch"}),
                status_code=404,
                mimetype="application/json",
            )

        # Get JD title for the report
        jd = get_jd(batch.get("jd_id", ""))
        jd_title = jd.get("title", "Unknown") if jd else "Unknown"

        # Generate Excel
        excel_bytes = generate_excel_report(candidates, jd_title)

        # Return Excel file directly as download
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        export_filename = f"batch_{batch_id[:8]}_{timestamp}.xlsx"

        log_with_context(logger, "INFO", f"Export generated: {export_filename}",
                        stage="export", trace_id=f"batch_{batch_id[:8]}")

        return func.HttpResponse(
            body=excel_bytes,
            status_code=200,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{export_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    except Exception as e:
        log_with_context(logger, "ERROR", f"Export failed: {e}",
                        stage="export", trace_id=f"batch_{batch_id[:8]}")
        return func.HttpResponse(
            json.dumps({"error": f"Export generation failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )
