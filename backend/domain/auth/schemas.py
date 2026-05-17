"""Auth schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    display_name: Optional[str] = None
    is_active: bool = True
    is_superadmin: bool = False
    role_ids: List[int] = []

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_superadmin: Optional[bool] = None
    role_ids: Optional[List[int]] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)

class RoleResponse(BaseModel):
    id: int; name: str; description: Optional[str]; is_system: bool
    permissions: List["PermissionResponse"] = []; created_at: datetime
    model_config = {"from_attributes": True}

class PermissionResponse(BaseModel):
    id: int; resource: str; action: str; description: Optional[str]
    model_config = {"from_attributes": True}

class UserResponse(BaseModel):
    id: int; username: str; email: str; display_name: Optional[str]; avatar_url: Optional[str]
    is_active: bool; is_superadmin: bool; roles: List[RoleResponse] = []; created_at: datetime; updated_at: Optional[datetime]
    model_config = {"from_attributes": True}

class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=64)
    description: Optional[str] = None
    permission_ids: List[int] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[int]] = None

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    scopes: List[str] = []
    expires_in_days: Optional[int] = None

class ApiKeyResponse(BaseModel):
    id: int; name: str; key_prefix: str; scopes: list; is_active: bool
    expires_at: Optional[datetime]; last_used_at: Optional[datetime]; created_at: datetime
    model_config = {"from_attributes": True}

class ApiKeyCreatedResponse(ApiKeyResponse):
    full_key: str = ""
