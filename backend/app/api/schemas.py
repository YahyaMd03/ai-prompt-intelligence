from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.domain.models import Category, Platform, Size


class PromptOptionsSchema(BaseModel):
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=3600)
    language: Optional[str] = Field(default=None, min_length=2, max_length=40)
    platform: Optional[Platform] = None
    size: Optional[Size] = None
    category: Optional[Category] = None

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().lower()


class ExtractOptionsRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=12000)


class ExtractOptionsResponse(BaseModel):
    run_id: UUID
    options: PromptOptionsSchema
    missing_fields: list[str]


class EnhancePromptRequest(BaseModel):
    run_id: UUID
    prompt: str = Field(min_length=10, max_length=12000)
    options: PromptOptionsSchema


class EnhancePromptResponse(BaseModel):
    run_id: UUID
    enhanced_prompt: str


class GenerateScriptRequest(BaseModel):
    run_id: UUID
    prompt: str = Field(min_length=10, max_length=12000)
    options: Optional[PromptOptionsSchema] = None


class GenerateScriptResponse(BaseModel):
    run_id: UUID
    script: str


class PromptRunResponse(BaseModel):
    run_id: UUID
    original_prompt: str
    current_prompt: str
    status: str
    options: PromptOptionsSchema
    latest_script: Optional[str] = None
