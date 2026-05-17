"""Team schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TeamMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str = ""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    joined_at: Optional[datetime] = None


class TeamCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    display_name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class TeamUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    require_review: Optional[bool] = None


class TeamResponse(BaseModel):
    id: int
    slug: str
    display_name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    is_personal: bool
    require_review: bool = False
    created_by: int
    member_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TeamDetailResponse(TeamResponse):
    members: List[TeamMemberResponse] = []


class AddMemberRequest(BaseModel):
    user_id: int
    role: str = "member"


class UpdateMemberRequest(BaseModel):
    role: str
