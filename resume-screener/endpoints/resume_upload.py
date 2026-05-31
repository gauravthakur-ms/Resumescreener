"""POST /api/resume/upload — Upload resumes and enqueue for processing."""

import uuid
import json
import azure.functions as func

from processing.duplicate_detector import compute_file_hash, check_duplicate_at_upload
from storage.blob_client import upload_resume, copy_resume_to_folder
from storage.queue_client import enqueue_resume
from storage.cosmos_client import get_jd, upsert_batch
from models.batch_model import Batch
from config import MAX_FILE_SIZE_MB
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = (".pdf", ".docx")


def handle_resume_upload(req: func.HttpRequest) -> func.HttpResponse:
    """POST /api/resume/upload?jd_id={jd_id}
    
    Upload one or many resume files. Enqueues all for async processing.
    
    Process:
    1. Validate jd_id exists
    2. Generate batch_id
    3. For each file: hash check, upload to blob, enqueue
    4. Create batch record
    5. Return batch_id (202 Accepted)
    """
    # Get jd_id from query params
    jd_id = req.params.get("jd_id")
    if not jd_id:
        return func.HttpResponse(
            json.dumps({"error": "Query parameter 'jd_id' is required"}),
            status_code=400,
            mimetype="application/json",
        )

    # Validate JD exists
    jd = get_jd(jd_id)
    if not jd:
        return func.HttpResponse(
            json.dumps({"error": f"JD not found: {jd_id}"}),
            status_code=404,
            mimetype="application/json",
        )

    # Get uploaded files
    files = req.files
    if not files:
        return func.HttpResponse(
            json.dumps({"error": "No files uploaded. Send resume files as multipart/form-data."}),
            status_code=400,
            mimetype="application/json",
        )

    # Collect all file objects from all field names (handles multiple files under same key)
    all_files = []
    for field_name in files:
        file_list = files.getlist(field_name)
        all_files.extend(file_list)

    if not all_files:
        return func.HttpResponse(
            json.dumps({"error": "No files uploaded. Send resume files as multipart/form-data."}),
            status_code=400,
            mimetype="application/json",
        )

    batch_id = str(uuid.uuid4())
    trace_id = f"batch_{batch_id[:8]}"

    total_uploaded = 0
    duplicates_skipped = 0
    queued = 0
    skipped_files = []

    for file_storage in all_files:
        file_name = file_storage.filename
        file_bytes = file_storage.read()

        # Validate file extension
        if not file_name.lower().endswith(SUPPORTED_EXTENSIONS):
            skipped_files.append({"file": file_name, "reason": "Unsupported format (only PDF/DOCX)"})
            continue

        # Validate file size
        if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
            skipped_files.append({"file": file_name, "reason": f"Exceeds {MAX_FILE_SIZE_MB}MB limit"})
            continue

        # Validate non-empty
        if len(file_bytes) == 0:
            skipped_files.append({"file": file_name, "reason": "Empty file"})
            continue

        total_uploaded += 1

        # Duplicate check (hash level only at upload)
        file_hash = compute_file_hash(file_bytes)
        existing = check_duplicate_at_upload(jd_id, file_hash)
        if existing:
            duplicates_skipped += 1
            # Still upload to duplicates folder for reference
            upload_resume(file_bytes, batch_id, file_name)
            copy_resume_to_folder(batch_id, file_name, "duplicates")
            continue

        # Upload to Blob
        blob_path = upload_resume(file_bytes, batch_id, file_name)

        # Enqueue for processing
        enqueue_resume(
            resume_blob_path=blob_path,
            jd_id=jd_id,
            batch_id=batch_id,
            file_name=file_name,
        )
        queued += 1

    # Create batch record in Cosmos
    batch = Batch(
        id=batch_id,
        jd_id=jd_id,
        total=queued + duplicates_skipped,
        queued=queued,
        duplicates=duplicates_skipped,
        status="queued" if queued > 0 else "completed",
    )
    upsert_batch(batch.to_cosmos_dict())

    log_with_context(
        logger, "INFO",
        f"Batch created: {batch_id} | Files: {total_uploaded} | Queued: {queued} | Dups: {duplicates_skipped}",
        trace_id=trace_id, stage="resume_upload",
    )

    response = {
        "batch_id": batch_id,
        "jd_id": jd_id,
        "total_uploaded": total_uploaded,
        "duplicates_skipped": duplicates_skipped,
        "queued_for_processing": queued,
        "status_url": f"/api/batch/{batch_id}/status",
    }

    if skipped_files:
        response["skipped_files"] = skipped_files

    return func.HttpResponse(
        json.dumps(response),
        status_code=202,
        mimetype="application/json",
    )
