"""Pydantic schema for Job Description documents stored in Cosmos DB."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SkillsConfig(BaseModel):
    mandatory: list[str] = Field(default_factory=list)
    primary: list[str] = Field(default_factory=list)
    secondary: list[str] = Field(default_factory=list)
    good_to_have: list[str] = Field(default_factory=list)


class ScoringWeights(BaseModel):
    mandatory_skills: float = 0.40
    primary_skills: float = 0.25
    experience: float = 0.20
    certifications: float = 0.10
    secondary_skills: float = 0.05


class Thresholds(BaseModel):
    selected: int = 70
    need_review: int = 50


class JobDescription(BaseModel):
    id: str
    title: str
    uploaded_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    domain: str = "General"
    min_experience_years: float = 0
    skills: SkillsConfig = Field(default_factory=SkillsConfig)
    certifications_preferred: list[str] = Field(default_factory=list)
    scoring_weights: ScoringWeights = Field(default_factory=ScoringWeights)
    thresholds: Thresholds = Field(default_factory=Thresholds)
    raw_text: Optional[str] = None

    def to_cosmos_dict(self) -> dict:
        """Convert to dict suitable for Cosmos DB upsert."""
        return self.model_dump(exclude_none=True)
