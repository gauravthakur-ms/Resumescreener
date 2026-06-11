"""Pydantic schema for Batch documents stored in Cosmos DB."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Batch(BaseModel):
    id: str
    jd_id: str
    user_id: str = ""
    uploaded_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    total: int = 0
    queued: int = 0
    processed: int = 0
    failed: int = 0
    duplicates: int = 0
    status: str = "queued"  # queued | processing | completed | failed
    completed_at: Optional[str] = None

    def to_cosmos_dict(self) -> dict:
        """Convert to dict suitable for Cosmos DB upsert."""
        return self.model_dump(exclude_none=True)
