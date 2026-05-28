"""Azure Queue Storage client — enqueue resume processing messages."""

import json
import base64
from azure.storage.queue import QueueServiceClient
from config import AZURE_STORAGE_CONNECTION_STRING, QUEUE_NAME
from utils.logger import get_logger

logger = get_logger(__name__)

_queue_service_client = None
_queue_client = None


def _get_queue_client():
    """Lazy-initialize Queue Client."""
    global _queue_service_client, _queue_client
    if _queue_client is None:
        _queue_service_client = QueueServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        # Ensure queue exists
        try:
            _queue_service_client.create_queue(QUEUE_NAME)
        except Exception:
            pass
        _queue_client = _queue_service_client.get_queue_client(QUEUE_NAME)
    return _queue_client


def enqueue_resume(resume_blob_path: str, jd_id: str, batch_id: str, file_name: str):
    """Enqueue a single resume for processing.
    
    Message format:
    {
        "resume_blob_path": "resumes/raw/{batch_id}/{filename}",
        "jd_id": "uuid",
        "batch_id": "uuid",
        "file_name": "resume.pdf"
    }
    """
    queue = _get_queue_client()
    message = {
        "resume_blob_path": resume_blob_path,
        "jd_id": jd_id,
        "batch_id": batch_id,
        "file_name": file_name,
    }
    # Azure Functions expects base64-encoded queue messages
    message_bytes = json.dumps(message).encode("utf-8")
    encoded_message = base64.b64encode(message_bytes).decode("utf-8")
    queue.send_message(encoded_message)


def enqueue_resume_batch(items: list[dict]):
    """Enqueue multiple resume processing messages.
    
    Each item should have: resume_blob_path, jd_id, batch_id, file_name
    """
    for item in items:
        enqueue_resume(
            resume_blob_path=item["resume_blob_path"],
            jd_id=item["jd_id"],
            batch_id=item["batch_id"],
            file_name=item["file_name"],
        )
