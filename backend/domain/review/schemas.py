"""Review schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ReviewSubmit(BaseModel):
    resource_type: str
    resource_id: int


class ReviewAction(BaseModel):
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    resource_type: str
    resource_id: int
    resource_name: Optional[str] = None
    team_id: int
    team_slug: Optional[str] = None
    submitter_id: int
    submitter_name: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_comment: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
