"""Pydantic schema for Resume Conversion documents stored in Cosmos DB."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ConversionPersonalInfo(BaseModel):
    name: str = "NDATA"
    ps_id: str = "NDATA"
    mobile: str = "NDATA"
    email: str = "NDATA"


class ConversionSkillsSummary(BaseModel):
    domain: str = ""
    programming_languages: str = ""
    tools: str = ""
    project_overview: str = ""


class ConversionProject(BaseModel):
    project_name: str = ""
    team_size: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""
    role_contributions: list[str] = Field(default_factory=list)
    technologies: str = ""


class ConversionOtherExperience(BaseModel):
    title: str = ""
    project_name: str = ""
    start_date: str = ""
    end_date: str = ""
    role_contributions: list[str] = Field(default_factory=list)
    technologies: str = ""


class ConversionEducation(BaseModel):
    degree: str = ""
    institution: str = ""
    year_range: str = ""
    percentage: str = ""


class ConversionCertification(BaseModel):
    name: str = ""
    validity: str = ""


class ResumeConversion(BaseModel):
    id: str
    user_id: str = ""
    original_file_name: str = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    status: str = "queued"  # queued | processing | completed | failed
    error_message: Optional[str] = None

    # Extracted data
    personal: ConversionPersonalInfo = Field(default_factory=ConversionPersonalInfo)
    experience_summary: list[str] = Field(default_factory=list)
    skills_summary: ConversionSkillsSummary = Field(default_factory=ConversionSkillsSummary)
    projects: list[ConversionProject] = Field(default_factory=list)
    other_experience: list[ConversionOtherExperience] = Field(default_factory=list)
    education: list[ConversionEducation] = Field(default_factory=list)
    certifications: list[ConversionCertification] = Field(default_factory=list)

    # Generated file reference
    generated_file_path: Optional[str] = None

    def to_cosmos_dict(self) -> dict:
        """Convert to dict suitable for Cosmos DB upsert."""
        return self.model_dump(exclude_none=True)
