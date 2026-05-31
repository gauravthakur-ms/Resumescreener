"""Screened Resumes endpoints — list candidates by JD and delete individual candidates."""

import json
import azure.functions as func

from storage.cosmos_client import get_candidates_by_jd, delete_candidate, get_jd
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
