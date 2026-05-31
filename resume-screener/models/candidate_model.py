"""Pydantic schema for Candidate documents stored in Cosmos DB."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PersonalInfo(BaseModel):
    name: str = "NDATA"
    email: str = "NDATA"
    phone: str = "NDATA"
    location: str = "NDATA"
    linkedin: str = "NDATA"
    current_organization: str = "NDATA"


class ExperienceEntry(BaseModel):
    organization: str
    start_end: str = "NDATA"
    duration_years: float = 0.0
    skills_used: list[str] = Field(default_factory=list)


class ExperienceInfo(BaseModel):
    total_years: float = 0.0
    relevant_years: float = 0.0
    last_work_date: str = "NDATA"
    freshness_flag: bool = False
    summary: str = "NDATA"
    individual: list[ExperienceEntry] = Field(default_factory=list)


class SkillsMatched(BaseModel):
    primary: dict[str, bool] = Field(default_factory=dict)
    secondary: dict[str, bool] = Field(default_factory=dict)


class Scoring(BaseModel):
    match_score: float = 0.0
    primary_score: float = 0.0
    secondary_score: float = 0.0
    experience_score: float = 0.0
    certification_score: float = 0.0
    risk_penalty: float = 0.0


class ConfidenceScores(BaseModel):
    name: str = "Low"
    email: str = "Low"
    experience_years: str = "Low"
    skills: str = "Low"


class CostTracking(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class Candidate(BaseModel):
    id: str
    jd_id: str
    batch_id: str
    processed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    file_name: str
    resume_hash: str = ""

    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    experience: ExperienceInfo = Field(default_factory=ExperienceInfo)
    skills_matched: SkillsMatched = Field(default_factory=SkillsMatched)
    certifications: list[str] = Field(default_factory=list)
    domain_classification: str = "General"

    scoring: Scoring = Field(default_factory=Scoring)
    risk_flags: list[str] = Field(default_factory=list)
    gaps: str = "No Gap"
    discrepancy: str = "No Discrepancy"

    recommendation: str = "Reject"
    screening: str = "NOK"
    rejection_reasons: list[str] = Field(default_factory=list)
    classification_folder: str = "rejected"

    recruiter_summary: str = ""
    confidence_scores: ConfidenceScores = Field(default_factory=ConfidenceScores)
    cost_tracking: CostTracking = Field(default_factory=CostTracking)

    is_duplicate: bool = False
    duplicate_of: Optional[str] = None

    def to_cosmos_dict(self) -> dict:
        """Convert to dict suitable for Cosmos DB upsert."""
        return self.model_dump(exclude_none=True)
