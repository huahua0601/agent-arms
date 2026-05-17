"""Auth API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core import settings
from middleware.auth import create_access_token, create_refresh_token, decode_token, get_current_user, PermissionChecker
from middleware import PaginatedResponse
from domain.auth import schemas as S, service as svc

router = APIRouter(prefix="/api", tags=["auth"])

@router.post("/auth/login", response_model=S.TokenResponse)
async def login(body: S.LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await svc.authenticate_user(db, body.username, body.password)
    if not user: raise HTTPException(401, "Invalid credentials")
    payload = svc.build_token_payload(user)
    return S.TokenResponse(access_token=create_access_token(payload), refresh_token=create_refresh_token(payload))

@router.post("/auth/refresh", response_model=S.TokenResponse)
async def refresh(body: S.RefreshRequest, db: AsyncSession = Depends(get_db)):
    data = decode_token(body.refresh_token)
    if data.get("type") != "refresh": raise HTTPException(401, "Invalid refresh token")
    user = await svc.get_user(db, int(data["sub"]))
    if not user or not user.is_active: raise HTTPException(401, "User not found or inactive")
    payload = svc.build_token_payload(user)
    return S.TokenResponse(access_token=create_access_token(payload), refresh_token=create_refresh_token(payload))

@router.get("/users/me", response_model=S.UserResponse)
async def get_me(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await svc.get_user(db, int(current["sub"]))
    if not user: raise HTTPException(404)
    return user

@router.put("/users/me", response_model=S.UserResponse)
async def update_me(body: S.UserUpdate, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    safe = body.model_dump(exclude_unset=True); safe.pop("is_superadmin", None); safe.pop("is_active", None); safe.pop("role_ids", None)
    user = await svc.update_user(db, int(current["sub"]), safe)
    if not user: raise HTTPException(404)
    return user

@router.get("/users", response_model=PaginatedResponse[S.UserResponse])
async def list_users(page: int = 1, page_size: int = 20, search: Optional[str] = None, _=Depends(PermissionChecker(["user:read"])), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_users(db, page, page_size, search)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=(total + page_size - 1) // page_size)

@router.post("/users", response_model=S.UserResponse, status_code=201)
async def create_user(body: S.UserCreate, _=Depends(PermissionChecker(["user:create"])), db: AsyncSession = Depends(get_db)):
    return await svc.create_user(db, body.model_dump())

@router.get("/users/{user_id}", response_model=S.UserResponse)
async def get_user(user_id: int, _=Depends(PermissionChecker(["user:read"])), db: AsyncSession = Depends(get_db)):
    user = await svc.get_user(db, user_id)
    if not user: raise HTTPException(404)
    return user

@router.put("/users/{user_id}", response_model=S.UserResponse)
async def update_user(user_id: int, body: S.UserUpdate, _=Depends(PermissionChecker(["user:update"])), db: AsyncSession = Depends(get_db)):
    user = await svc.update_user(db, user_id, body.model_dump(exclude_unset=True))
    if not user: raise HTTPException(404)
    return user

@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, _=Depends(PermissionChecker(["user:delete"])), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_user(db, user_id): raise HTTPException(404)

@router.get("/roles", response_model=list[S.RoleResponse])
async def list_roles(_=Depends(PermissionChecker(["role:read"])), db: AsyncSession = Depends(get_db)):
    return await svc.list_roles(db)

@router.post("/roles", response_model=S.RoleResponse, status_code=201)
async def create_role(body: S.RoleCreate, _=Depends(PermissionChecker(["role:create"])), db: AsyncSession = Depends(get_db)):
    return await svc.create_role(db, body.model_dump())

@router.put("/roles/{role_id}", response_model=S.RoleResponse)
async def update_role(role_id: int, body: S.RoleUpdate, _=Depends(PermissionChecker(["role:update"])), db: AsyncSession = Depends(get_db)):
    role = await svc.update_role(db, role_id, body.model_dump(exclude_unset=True))
    if not role: raise HTTPException(404)
    return role

@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(role_id: int, _=Depends(PermissionChecker(["role:delete"])), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_role(db, role_id): raise HTTPException(404)

@router.get("/permissions", response_model=list[S.PermissionResponse])
async def list_permissions(_=Depends(PermissionChecker(["role:read"])), db: AsyncSession = Depends(get_db)):
    return await svc.list_permissions(db)

@router.get("/api-keys", response_model=list[S.ApiKeyResponse])
async def list_api_keys(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_api_keys(db, int(current["sub"]))

@router.post("/api-keys", response_model=S.ApiKeyCreatedResponse, status_code=201)
async def create_api_key(body: S.ApiKeyCreate, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key_obj, raw = await svc.create_api_key(db, int(current["sub"]), body.model_dump())
    resp = S.ApiKeyCreatedResponse.model_validate(key_obj); resp.full_key = raw; return resp

@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(key_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_api_key(db, key_id, int(current["sub"])): raise HTTPException(404)
