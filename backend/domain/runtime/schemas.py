"""Runtime schemas."""
from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, Field

class InstanceCreate(BaseModel):
    server_id: int; server_name: Optional[str] = None
    image: str = Field(...); command: Optional[str] = None
    cpu_limit: str = "0.5"; memory_limit: str = "256m"; env_vars: Optional[Dict[str, str]] = None

class InstanceResponse(BaseModel):
    id: int; server_id: int; server_name: Optional[str]; container_id: Optional[str]
    status: str; port: Optional[int]; cpu_limit: Optional[str]; memory_limit: Optional[str]
    image: Optional[str]; command: Optional[str]; started_at: Optional[datetime]; stopped_at: Optional[datetime]; created_at: datetime
    model_config = {"from_attributes": True}

class HealthCheckResponse(BaseModel):
    id: int; instance_id: int; status: str; response_time_ms: Optional[float]; detail: Optional[str]; checked_at: datetime
    model_config = {"from_attributes": True}

class LogsResponse(BaseModel):
    instance_id: int; logs: str
