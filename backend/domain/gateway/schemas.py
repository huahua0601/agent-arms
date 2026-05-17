"""Gateway Pydantic schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class GatewayCallLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    api_key_id: Optional[int] = None
    server_id: Optional[int] = None
    server_namespace: Optional[str] = None
    method: Optional[str] = None
    tool_name: Optional[str] = None
    request_params: Optional[dict] = None
    response_status: Optional[str] = None
    error_message: Optional[str] = None
    latency_ms: Optional[float] = None
    request_size: Optional[int] = None
    response_size: Optional[int] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GatewayOverview(BaseModel):
    total_calls: int = 0
    today_calls: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    error_count_today: int = 0


class GatewayTrendPoint(BaseModel):
    date: str
    total: int = 0
    success: int = 0
    error: int = 0


class TopItem(BaseModel):
    name: str
    value: int
    extra: Optional[str] = None


class GatewayErrorItem(BaseModel):
    id: int
    server_namespace: Optional[str] = None
    method: Optional[str] = None
    error_message: Optional[str] = None
    username: Optional[str] = None
    created_at: Optional[datetime] = None
