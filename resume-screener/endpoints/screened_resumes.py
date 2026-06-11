"""Screened Resumes endpoints — list candidates by JD, delete, and export."""

import json
from datetime import datetime
import azure.functions as func

from storage.cosmos_client import get_candidates_by_jd, delete_candidate, get_jd
from auth.token_validator import get_user_id
from utils.excel_exporter import generate_excel_report
from utils.logger import get_logger

logger = get_logger(__name__)


def handle_get_candidates_by_jd(req: func.HttpRequest) -> func.HttpResponse:
    """GET /api/jd/{jd_id}/candidates — List all screened candidates for a JD."""
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

    # Verify ownership
    user_id = get_user_id(req)
    if jd.get("user_id") and jd["user_id"] != user_id:
        return func.HttpResponse(
            json.dumps({"error": "Access denied"}),
            status_code=403,
            mimetype="application/json",
        )

    candidates = get_candidates_by_jd(jd_id)

    # Clean Cosmos metadata
    for c in candidates:
        c.pop("_rid", None)
        c.pop("_self", None)
        c.pop("_etag", None)
        c.pop("_attachments", None)
        c.pop("_ts", None)

    return func.HttpResponse(
        json.dumps({
            "jd_id": jd_id,
            "jd_title": jd.get("title", ""),
            "certifications_preferred": jd.get("certifications_preferred", []),
            "total": len(candidates),
            "candidates": candidates,
        }),
        status_code=200,
        mimetype="application/json",
    )


def handle_delete_candidate(req: func.HttpRequest) -> func.HttpResponse:
    """DELETE /api/candidate/{candidate_id}?jd_id={jd_id} — Delete a specific screened resume."""
    candidate_id = req.route_params.get("candidate_id")
    jd_id = req.params.get("jd_id")

    if not candidate_id or not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "candidate_id (path) and jd_id (query) are required"}),
            status_code=400,
            mimetype="application/json",
        )

    # Verify ownership via JD
    jd = get_jd(jd_id)
    if not jd:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )
    user_id = get_user_id(req)
    if jd.get("user_id") and jd["user_id"] != user_id:
        return func.HttpResponse(
            json.dumps({"error": "Access denied"}),
            status_code=403,
            mimetype="application/json",
        )

    deleted = delete_candidate(candidate_id, jd_id)
    if not deleted:
        return func.HttpResponse(
            json.dumps({"error": f"Candidate not found: {candidate_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    return func.HttpResponse(
        json.dumps({"message": "Candidate deleted", "id": candidate_id}),
        status_code=200,
        mimetype="application/json",
    )


def handle_jd_export(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/jd/{jd_id}/export — Export filtered screened candidates for a JD as Excel."""
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

    # Verify ownership
    user_id = get_user_id(req)
    if jd.get("user_id") and jd["user_id"] != user_id:
        return func.HttpResponse(
            json.dumps({"error": "Access denied"}),
            status_code=403,
            mimetype="application/json",
        )

    try:
        # Accept filtered candidates from POST body; fall back to all candidates
        body = req.get_body().decode("utf-8", errors="ignore")
        if body:
            payload = json.loads(body)
            candidates = payload.get("candidates", [])
        else:
            candidates = get_candidates_by_jd(jd_id)

        if not candidates:
            return func.HttpResponse(
                json.dumps({"error": "No candidates found for this JD"}),
                status_code=404,
                mimetype="application/json",
            )

        jd_title = jd.get("title", "Unknown")
        excel_bytes = generate_excel_report(candidates, jd_title)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        export_filename = f"jd_{jd_title[:20].replace(' ', '_')}_{timestamp}.xlsx"

        logger.info(f"JD export generated: {export_filename}")

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
        logger.error(f"JD export failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"Export generation failed: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
        )
