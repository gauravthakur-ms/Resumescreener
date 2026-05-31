"""Cosmos DB CRUD operations for JD, Candidate, and Batch containers."""

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from config import (
    AZURE_COSMOS_ENDPOINT,
    AZURE_COSMOS_KEY,
    AZURE_COSMOS_DATABASE_NAME,
    COSMOS_CONTAINER_JD,
    COSMOS_CONTAINER_CANDIDATES,
    COSMOS_CONTAINER_BATCHES,
)
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

_client = None
_database = None


def _get_database():
    """Lazy-initialize Cosmos DB client and database reference."""
    global _client, _database
    if _database is None:
        _client = CosmosClient(AZURE_COSMOS_ENDPOINT, credential=AZURE_COSMOS_KEY)
        _database = _client.get_database_client(AZURE_COSMOS_DATABASE_NAME)
    return _database


def _get_container(container_name: str):
    """Get a container client by name."""
    db = _get_database()
    return db.get_container_client(container_name)


# --- Job Descriptions ---

def upsert_jd(jd_data: dict) -> dict:
    """Upsert a Job Description document."""
    container = _get_container(COSMOS_CONTAINER_JD)
    return container.upsert_item(jd_data)


def get_jd(jd_id: str) -> dict | None:
    """Get a JD by its ID."""
    container = _get_container(COSMOS_CONTAINER_JD)
    try:
        return container.read_item(item=jd_id, partition_key=jd_id)
    except exceptions.CosmosResourceNotFoundError:
        return None


def list_jds() -> list[dict]:
    """List all job descriptions."""
    container = _get_container(COSMOS_CONTAINER_JD)
    query = "SELECT * FROM c ORDER BY c.uploaded_at DESC"
    return list(container.query_items(query=query, enable_cross_partition_query=True))


def delete_jd(jd_id: str) -> bool:
    """Delete a JD by its ID. Returns True if deleted, False if not found."""
    container = _get_container(COSMOS_CONTAINER_JD)
    try:
        container.delete_item(item=jd_id, partition_key=jd_id)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False


# --- Candidates ---

def upsert_candidate(candidate_data: dict) -> dict:
    """Upsert a candidate document."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)
    return container.upsert_item(candidate_data)


def get_candidate(candidate_id: str, jd_id: str) -> dict | None:
    """Get a candidate by ID."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)
    try:
        return container.read_item(item=candidate_id, partition_key=jd_id)
    except exceptions.CosmosResourceNotFoundError:
        return None


def get_candidates_by_batch(batch_id: str, top: int = None, sort_by: str = "match_score") -> list[dict]:
    """Get all candidates for a batch, sorted by score."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)

    sort_field_map = {
        "match_score": "c.scoring.match_score",
        "relevant_experience": "c.experience.relevant_years",
        "recommendation": "c.recommendation",
    }
    sort_field = sort_field_map.get(sort_by, "c.scoring.match_score")

    query = f"SELECT * FROM c WHERE c.batch_id = @batch_id ORDER BY {sort_field} DESC"
    parameters = [{"name": "@batch_id", "value": batch_id}]

    results = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True,
    ))

    if top:
        return results[:top]
    return results


def get_candidates_by_jd(jd_id: str) -> list[dict]:
    """Get all candidates screened against a specific JD."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)
    query = "SELECT * FROM c WHERE c.jd_id = @jd_id ORDER BY c.scoring.match_score DESC"
    parameters = [{"name": "@jd_id", "value": jd_id}]
    return list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True,
    ))


def delete_candidate(candidate_id: str, jd_id: str) -> bool:
    """Delete a candidate by ID. Returns True if deleted."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)
    try:
        container.delete_item(item=candidate_id, partition_key=jd_id)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False


def check_duplicate_by_hash(jd_id: str, resume_hash: str) -> dict | None:
    """Check if a candidate with the same resume hash exists for this JD."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)
    query = "SELECT * FROM c WHERE c.jd_id = @jd_id AND c.resume_hash = @hash"
    parameters = [
        {"name": "@jd_id", "value": jd_id},
        {"name": "@hash", "value": resume_hash},
    ]
    results = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True,
    ))
    return results[0] if results else None


def check_duplicate_by_email_phone(jd_id: str, email: str, phone: str) -> dict | None:
    """Check if a candidate with same email or phone exists for this JD."""
    container = _get_container(COSMOS_CONTAINER_CANDIDATES)

    conditions = []
    parameters = [{"name": "@jd_id", "value": jd_id}]

    if email and email != "NDATA":
        conditions.append("c.personal.email = @email")
        parameters.append({"name": "@email", "value": email})
    if phone and phone != "NDATA":
        conditions.append("c.personal.phone = @phone")
        parameters.append({"name": "@phone", "value": phone})

    if not conditions:
        return None

    where_clause = " OR ".join(conditions)
    query = f"SELECT * FROM c WHERE c.jd_id = @jd_id AND ({where_clause})"

    results = list(container.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True,
    ))
    return results[0] if results else None


# --- Batches ---

def upsert_batch(batch_data: dict) -> dict:
    """Upsert a batch document."""
    container = _get_container(COSMOS_CONTAINER_BATCHES)
    return container.upsert_item(batch_data)


def get_batch(batch_id: str) -> dict | None:
    """Get a batch by ID."""
    container = _get_container(COSMOS_CONTAINER_BATCHES)
    try:
        return container.read_item(item=batch_id, partition_key=batch_id)
    except exceptions.CosmosResourceNotFoundError:
        return None


def list_batches(limit: int = 20) -> list[dict]:
    """List recent batches ordered by upload time (newest first)."""
    container = _get_container(COSMOS_CONTAINER_BATCHES)
    query = "SELECT * FROM c ORDER BY c.uploaded_at DESC OFFSET 0 LIMIT @limit"
    params = [{"name": "@limit", "value": limit}]
    return list(container.query_items(
        query=query,
        parameters=params,
        enable_cross_partition_query=True,
    ))


def delete_batch(batch_id: str) -> bool:
    """Delete a batch by its ID. Returns True if deleted, False if not found."""
    container = _get_container(COSMOS_CONTAINER_BATCHES)
    try:
        container.delete_item(item=batch_id, partition_key=batch_id)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False


def increment_batch_counter(batch_id: str, field: str):
    """Increment a counter field on a batch document (processed, failed, duplicates)."""
    batch = get_batch(batch_id)
    if batch:
        batch[field] = batch.get(field, 0) + 1
        # Check if all processed
        total = batch.get("total", 0)
        done = batch.get("processed", 0) + batch.get("failed", 0) + batch.get("duplicates", 0)
        # If done exceeds total (e.g. due to retries), adjust total
        if done > total:
            batch["total"] = done
            total = done
        if done >= total:
            batch["status"] = "completed"
            from datetime import datetime
            batch["completed_at"] = datetime.utcnow().isoformat() + "Z"
        else:
            batch["status"] = "processing"
        upsert_batch(batch)
