"""Skill schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SkillTagResponse(BaseModel):
    id: int; name: str
    model_config = {"from_attributes": True}

class SkillVersionResponse(BaseModel):
    id: int; skill_id: int; version: str; changelog: Optional[str]; published_at: datetime
    model_config = {"from_attributes": True}

class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    namespace: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    content: str = Field(..., min_length=1)
    category: str = "general"
    version: str = "1.0.0"
    icon_url: Optional[str] = None
    is_public: bool = True
    parameters: Optional[Dict[str, Any]] = None
    trigger_pattern: Optional[str] = None
    tag_names: List[str] = []

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    icon_url: Optional[str] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    trigger_pattern: Optional[str] = None
    tag_names: Optional[List[str]] = None

class SkillResponse(BaseModel):
    id: int; name: str; namespace: str; description: Optional[str]
    content: str; category: str; version: str
    author_id: int; author_name: Optional[str]
    icon_url: Optional[str]; status: str; is_public: bool
    downloads: int; parameters: Optional[Dict[str, Any]]
    trigger_pattern: Optional[str]
    tags: List[SkillTagResponse] = []
    versions: List[SkillVersionResponse] = []
    created_at: datetime; updated_at: Optional[datetime]
    model_config = {"from_attributes": True}

class SkillListItem(BaseModel):
    id: int; name: str; namespace: str; description: Optional[str]
    category: str; version: str; author_id: int; author_name: Optional[str]
    icon_url: Optional[str]; status: str; is_public: bool; downloads: int
    trigger_pattern: Optional[str]
    tags: List[SkillTagResponse] = []
    created_at: datetime
    model_config = {"from_attributes": True}

class VersionCreate(BaseModel):
    version: str
    content: str
    changelog: Optional[str] = None

SKILL_CATEGORIES = [
    "general", "coding", "devops", "data", "security",
    "writing", "research", "automation", "integration", "other",
]
