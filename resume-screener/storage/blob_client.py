"""Azure Blob Storage client — upload, download, copy/move to classified folders."""

from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta, timezone
from config import (
    AZURE_STORAGE_CONNECTION_STRING,
    BLOB_CONTAINER_JD,
    BLOB_CONTAINER_RESUMES,
    BLOB_CONTAINER_EXPORTS,
)
from utils.logger import get_logger

logger = get_logger(__name__)

_blob_service_client = None


def _get_blob_service():
    """Lazy-initialize Blob Service Client."""
    global _blob_service_client
    if _blob_service_client is None:
        _blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    return _blob_service_client


def _ensure_container(container_name: str):
    """Ensure a blob container exists."""
    service = _get_blob_service()
    try:
        service.create_container(container_name)
    except Exception:
        pass  # Container already exists


def upload_jd_file(file_bytes: bytes, file_name: str) -> str:
    """Upload a JD file to the jd-uploads container. Returns blob path."""
    _ensure_container(BLOB_CONTAINER_JD)
    service = _get_blob_service()
    blob_path = f"{file_name}"
    blob_client = service.get_blob_client(container=BLOB_CONTAINER_JD, blob=blob_path)
    blob_client.upload_blob(file_bytes, overwrite=True)
    return f"{BLOB_CONTAINER_JD}/{blob_path}"


def upload_resume(file_bytes: bytes, batch_id: str, file_name: str) -> str:
    """Upload a resume to resumes/raw/{batch_id}/. Returns blob path."""
    _ensure_container(BLOB_CONTAINER_RESUMES)
    service = _get_blob_service()
    blob_path = f"raw/{batch_id}/{file_name}"
    blob_client = service.get_blob_client(container=BLOB_CONTAINER_RESUMES, blob=blob_path)
    blob_client.upload_blob(file_bytes, overwrite=True)
    return f"{BLOB_CONTAINER_RESUMES}/{blob_path}"


def download_resume(blob_path: str) -> bytes:
    """Download a resume file from blob storage. blob_path is relative to resumes container."""
    service = _get_blob_service()
    # blob_path could be "raw/{batch_id}/{filename}" or full "resumes/raw/..."
    if blob_path.startswith(f"{BLOB_CONTAINER_RESUMES}/"):
        blob_path = blob_path[len(f"{BLOB_CONTAINER_RESUMES}/"):]
    blob_client = service.get_blob_client(container=BLOB_CONTAINER_RESUMES, blob=blob_path)
    return blob_client.download_blob().readall()


def copy_resume_to_folder(batch_id: str, file_name: str, folder: str):
    """Copy a resume from raw/ to a classified folder (selected/, rejected/, need-review/, duplicates/).
    
    folder should be one of: 'selected', 'rejected', 'need-review', 'duplicates'
    """
    service = _get_blob_service()
    source_path = f"raw/{batch_id}/{file_name}"
    dest_path = f"{folder}/{file_name}"

    source_blob = service.get_blob_client(container=BLOB_CONTAINER_RESUMES, blob=source_path)
    dest_blob = service.get_blob_client(container=BLOB_CONTAINER_RESUMES, blob=dest_path)

    # Copy from source
    dest_blob.start_copy_from_url(source_blob.url)


def upload_export(file_bytes: bytes, file_name: str) -> str:
    """Upload an Excel export file. Returns the blob path."""
    _ensure_container(BLOB_CONTAINER_EXPORTS)
    service = _get_blob_service()
    blob_client = service.get_blob_client(container=BLOB_CONTAINER_EXPORTS, blob=file_name)
    blob_client.upload_blob(file_bytes, overwrite=True)
    return f"{BLOB_CONTAINER_EXPORTS}/{file_name}"


def get_export_sas_url(file_name: str, expiry_hours: int = 1) -> str:
    """Generate a SAS URL for downloading an export file."""
    service = _get_blob_service()
    blob_client = service.get_blob_client(container=BLOB_CONTAINER_EXPORTS, blob=file_name)

    # Parse account info from connection string
    account_name = service.account_name
    account_key = None
    for part in AZURE_STORAGE_CONNECTION_STRING.split(";"):
        if part.startswith("AccountKey="):
            account_key = part[len("AccountKey="):]
            break

    if not account_key:
        return blob_client.url

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=BLOB_CONTAINER_EXPORTS,
        blob_name=file_name,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_hours),
    )
    return f"{blob_client.url}?{sas_token}"
