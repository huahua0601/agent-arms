"""Registry schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class TagResponse(BaseModel):
    id: int; name: str
    model_config = {"from_attributes": True}

class McpToolResponse(BaseModel):
    id: int; server_id: int; name: str; description: Optional[str]; input_schema: Optional[Dict[str, Any]]
    model_config = {"from_attributes": True}

class McpResourceResponse(BaseModel):
    id: int; server_id: int; uri_template: str; name: str; description: Optional[str]; mime_type: Optional[str]
    model_config = {"from_attributes": True}

class McpPromptResponse(BaseModel):
    id: int; server_id: int; name: str; description: Optional[str]; arguments: Optional[Dict[str, Any]]
    model_config = {"from_attributes": True}

class ServerVersionResponse(BaseModel):
    id: int; server_id: int; version: str; changelog: Optional[str]; published_at: datetime
    model_config = {"from_attributes": True}

class McpServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    namespace: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None; version: str = "0.1.0"
    transport_type: str = "stdio"; endpoint_url: Optional[str] = None
    source_type: str = "external"; config_schema: Optional[Dict[str, Any]] = None
    auth_type: str = "none"
    auth_config: Optional[Dict[str, str]] = None
    readme: Optional[str] = None; icon_url: Optional[str] = None; tag_names: List[str] = []

class McpServerUpdate(BaseModel):
    name: Optional[str] = None; description: Optional[str] = None; version: Optional[str] = None
    transport_type: Optional[str] = None; endpoint_url: Optional[str] = None
    source_type: Optional[str] = None
    config_schema: Optional[Dict[str, Any]] = None; readme: Optional[str] = None
    icon_url: Optional[str] = None; status: Optional[str] = None; tag_names: Optional[List[str]] = None
    auth_type: Optional[str] = None
    auth_config: Optional[Dict[str, str]] = None

class McpServerResponse(BaseModel):
    id: int; name: str; namespace: str; description: Optional[str]; version: str
    transport_type: str; endpoint_url: Optional[str]; source_type: str; icon_url: Optional[str]
    owner_id: int; status: str; downloads: int
    auth_type: Optional[str] = "none"
    auth_config: Optional[Dict[str, str]] = None
    openapi_spec: Optional[Dict[str, Any]] = None
    tunnel_enabled: Optional[bool] = False
    health_status: Optional[str] = "unknown"
    last_health_check: Optional[datetime] = None
    health_latency_ms: Optional[float] = None
    tags: List[TagResponse] = []
    tools: List[McpToolResponse] = []; resources: List[McpResourceResponse] = []; prompts: List[McpPromptResponse] = []
    created_at: datetime; updated_at: Optional[datetime]
    model_config = {"from_attributes": True}

class McpServerListItem(BaseModel):
    id: int; name: str; namespace: str; description: Optional[str]; version: str
    transport_type: str; source_type: str; icon_url: Optional[str]; owner_id: int
    status: str; downloads: int; auth_type: Optional[str] = "none"
    health_status: Optional[str] = "unknown"; health_latency_ms: Optional[float] = None
    tags: List[TagResponse] = []
    tool_count: int = 0; resource_count: int = 0; prompt_count: int = 0; created_at: datetime
    model_config = {"from_attributes": True}

class VersionCreate(BaseModel):
    version: str; changelog: Optional[str] = None
