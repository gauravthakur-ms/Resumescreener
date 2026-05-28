"""Duplicate detection — hash, email, and phone-based deduplication."""

import hashlib
from storage.cosmos_client import check_duplicate_by_hash, check_duplicate_by_email_phone
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)


def compute_file_hash(file_bytes: bytes) -> str:
    """Compute SHA-256 hash of file content."""
    return hashlib.sha256(file_bytes).hexdigest()


def check_duplicate_at_upload(jd_id: str, file_hash: str) -> dict | None:
    """Check for duplicate at upload time using file hash only.
    
    Returns the existing candidate record if duplicate found, else None.
    """
    return check_duplicate_by_hash(jd_id, file_hash)


def check_duplicate_at_processing(
    jd_id: str,
    email: str,
    phone: str,
    resume_hash: str,
    trace_id: str = "",
) -> dict | None:
    """Check for duplicate during queue processing using email and phone.
    
    This is the second layer of dedup (after hash check at upload).
    Returns the existing candidate record if duplicate found, else None.
    """
    # Layer 1: Hash (re-check in case of race condition)
    existing = check_duplicate_by_hash(jd_id, resume_hash)
    if existing:
        log_with_context(logger, "INFO", f"Duplicate detected by hash",
                        trace_id=trace_id, stage="duplicate_check")
        return existing

    # Layer 2 & 3: Email and phone
    existing = check_duplicate_by_email_phone(jd_id, email, phone)
    if existing:
        log_with_context(logger, "INFO", f"Duplicate detected by email/phone",
                        trace_id=trace_id, stage="duplicate_check")
        return existing

    return None
