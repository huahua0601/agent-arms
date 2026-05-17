"""Audit schemas."""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel

class AuditLogResponse(BaseModel):
    id: int; user_id: Optional[int]; username: Optional[str]; action: str
    resource_type: str; resource_id: Optional[str]; detail: Optional[Dict[str, Any]]
    ip_address: Optional[str]; user_agent: Optional[str]; status: str; created_at: datetime
    model_config = {"from_attributes": True}

class AuditStatsResponse(BaseModel):
    total_events: int; today_events: int; success_count: int; failure_count: int
    top_users: list; top_actions: list
