"""Audit API router."""
from typing import Optional
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from middleware.auth import PermissionChecker
from middleware import PaginatedResponse
from domain.audit import schemas as S, service as svc

router = APIRouter(prefix="/api", tags=["audit"])

@router.get("/audit/logs", response_model=PaginatedResponse[S.AuditLogResponse])
async def list_logs(page: int = 1, page_size: int = 50, user_id: Optional[int] = None, username: Optional[str] = None, action: Optional[str] = None, resource_type: Optional[str] = None, status: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None, _=Depends(PermissionChecker(["audit_log:read"])), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_logs(db, page, page_size, user_id, username, action, resource_type, status, date_from, date_to)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=(total+page_size-1)//page_size if total else 0)

@router.get("/audit/stats", response_model=S.AuditStatsResponse)
async def stats(_=Depends(PermissionChecker(["audit_log:read"])), db: AsyncSession = Depends(get_db)):
    return await svc.get_stats(db)

@router.get("/audit/logs/export")
async def export(username: Optional[str] = None, action: Optional[str] = None, resource_type: Optional[str] = None, status: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None, _=Depends(PermissionChecker(["audit_log:export"])), db: AsyncSession = Depends(get_db)):
    data = await svc.export_csv(db, username=username, action=action, resource_type=resource_type, status=status, date_from=date_from, date_to=date_to)
    return Response(content=data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit_logs.csv"})
