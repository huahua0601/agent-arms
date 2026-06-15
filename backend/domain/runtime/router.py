"""Runtime API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from middleware.auth import get_current_user, PermissionChecker
from middleware import PaginatedResponse
from domain.runtime import schemas as S, service as svc

router = APIRouter(prefix="/api", tags=["runtime"])

@router.post("/instances", response_model=S.InstanceResponse, status_code=201)
async def create_instance(body: S.InstanceCreate, _=Depends(PermissionChecker(["mcp_instance:create"])), db: AsyncSession = Depends(get_db)):
    return await svc.create_instance(db, body.model_dump())

@router.get("/instances", response_model=PaginatedResponse[S.InstanceResponse])
async def list_instances(page: int = 1, page_size: int = 20, server_id: Optional[int] = None, status: Optional[str] = None, _=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_instances(db, page, page_size, server_id, status)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=(total+page_size-1)//page_size if total else 0)

@router.get("/instances/{iid}", response_model=S.InstanceResponse)
async def get_instance(iid: int, _=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    inst = await svc.get_instance(db, iid)
    if not inst: raise HTTPException(404)
    return inst

@router.post("/instances/{iid}/start", response_model=S.InstanceResponse)
async def start(iid: int, _=Depends(PermissionChecker(["mcp_instance:update"])), db: AsyncSession = Depends(get_db)):
    r = await svc.start_instance(db, iid)
    if not r: raise HTTPException(404)
    return r

@router.post("/instances/{iid}/stop", response_model=S.InstanceResponse)
async def stop(iid: int, _=Depends(PermissionChecker(["mcp_instance:update"])), db: AsyncSession = Depends(get_db)):
    r = await svc.stop_instance(db, iid)
    if not r: raise HTTPException(404)
    return r

@router.post("/instances/{iid}/restart", response_model=S.InstanceResponse)
async def restart(iid: int, _=Depends(PermissionChecker(["mcp_instance:update"])), db: AsyncSession = Depends(get_db)):
    r = await svc.restart_instance(db, iid)
    if not r: raise HTTPException(404)
    return r

@router.delete("/instances/{iid}", status_code=204)
async def delete(iid: int, _=Depends(PermissionChecker(["mcp_instance:delete"])), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_instance(db, iid): raise HTTPException(404)

@router.patch("/instances/{iid}", response_model=S.InstanceResponse)
async def patch_instance(iid: int, body: dict, _=Depends(PermissionChecker(["mcp_instance:update"])), db: AsyncSession = Depends(get_db)):
    inst = await svc.get_instance(db, iid)
    if not inst: raise HTTPException(404)
    for key in ("container_id", "status", "runtime_type"):
        if key in body:
            setattr(inst, key, body[key])
    if body.get("status") == "running":
        import datetime
        inst.started_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(inst)
    return inst

@router.get("/instances/{iid}/logs", response_model=S.LogsResponse)
async def logs(iid: int, tail: int = 200, _=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    l = await svc.get_logs(db, iid, tail)
    if l is None: raise HTTPException(404)
    return S.LogsResponse(instance_id=iid, logs=l)

@router.get("/instances/{iid}/health", response_model=S.HealthCheckResponse)
async def health(iid: int, _=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    hc = await svc.check_health(db, iid)
    if not hc: raise HTTPException(404)
    return hc
