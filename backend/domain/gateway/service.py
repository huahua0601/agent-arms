"""Gateway statistics service and stats router."""
import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from middleware.auth import PermissionChecker
from middleware import PaginatedResponse
from domain.gateway.models import GatewayCallLog
from domain.gateway.schemas import (
    GatewayCallLogResponse, GatewayOverview, GatewayTrendPoint,
    TopItem, GatewayErrorItem,
)

stats_router = APIRouter(prefix="/api/gateway", tags=["Gateway Stats"])


async def _overview(db: AsyncSession) -> GatewayOverview:
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total = (await db.execute(select(func.count(GatewayCallLog.id)))).scalar() or 0
    today_total = (await db.execute(
        select(func.count(GatewayCallLog.id)).where(GatewayCallLog.created_at >= today_start)
    )).scalar() or 0
    success_count = (await db.execute(
        select(func.count(GatewayCallLog.id)).where(GatewayCallLog.response_status == "success")
    )).scalar() or 0
    avg_lat = (await db.execute(
        select(func.avg(GatewayCallLog.latency_ms)).where(GatewayCallLog.latency_ms.isnot(None))
    )).scalar()
    error_today = (await db.execute(
        select(func.count(GatewayCallLog.id)).where(
            GatewayCallLog.created_at >= today_start,
            GatewayCallLog.response_status != "success"
        )
    )).scalar() or 0

    return GatewayOverview(
        total_calls=total,
        today_calls=today_total,
        success_rate=round(success_count / total * 100, 1) if total > 0 else 0.0,
        avg_latency_ms=round(avg_lat, 1) if avg_lat else 0.0,
        error_count_today=error_today,
    )


async def _trend(db: AsyncSession, days: int = 7) -> List[GatewayTrendPoint]:
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    date_col = func.date(GatewayCallLog.created_at)
    rows = (await db.execute(
        select(
            date_col.label("d"),
            func.count(GatewayCallLog.id).label("total"),
            func.count(case((GatewayCallLog.response_status == "success", 1))).label("success"),
            func.count(case((GatewayCallLog.response_status != "success", 1))).label("error"),
        )
        .where(GatewayCallLog.created_at >= since)
        .group_by(date_col)
        .order_by(date_col)
    )).all()

    result = []
    for r in rows:
        result.append(GatewayTrendPoint(
            date=str(r.d), total=r.total, success=r.success, error=r.error
        ))
    return result


async def _top_servers(db: AsyncSession, limit: int = 10) -> List[TopItem]:
    rows = (await db.execute(
        select(
            GatewayCallLog.server_namespace,
            func.count(GatewayCallLog.id).label("cnt"),
        )
        .where(GatewayCallLog.server_namespace.isnot(None))
        .group_by(GatewayCallLog.server_namespace)
        .order_by(desc("cnt"))
        .limit(limit)
    )).all()
    return [TopItem(name=r.server_namespace or "unknown", value=r.cnt) for r in rows]


async def _top_tools(db: AsyncSession, limit: int = 10) -> List[TopItem]:
    rows = (await db.execute(
        select(
            GatewayCallLog.tool_name,
            GatewayCallLog.server_namespace,
            func.count(GatewayCallLog.id).label("cnt"),
        )
        .where(GatewayCallLog.tool_name.isnot(None))
        .group_by(GatewayCallLog.tool_name, GatewayCallLog.server_namespace)
        .order_by(desc("cnt"))
        .limit(limit)
    )).all()
    return [TopItem(name=r.tool_name, value=r.cnt, extra=r.server_namespace) for r in rows]


async def _top_users(db: AsyncSession, limit: int = 10) -> List[TopItem]:
    rows = (await db.execute(
        select(
            GatewayCallLog.username,
            func.count(GatewayCallLog.id).label("cnt"),
        )
        .where(GatewayCallLog.username.isnot(None))
        .group_by(GatewayCallLog.username)
        .order_by(desc("cnt"))
        .limit(limit)
    )).all()
    return [TopItem(name=r.username or "unknown", value=r.cnt) for r in rows]


async def _recent_errors(db: AsyncSession, page: int = 1, page_size: int = 20):
    base = select(GatewayCallLog).where(GatewayCallLog.response_status != "success")
    count_q = select(func.count(GatewayCallLog.id)).where(GatewayCallLog.response_status != "success")
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(
        base.order_by(desc(GatewayCallLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()
    return items, total


async def _list_logs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    server_id: Optional[int] = None,
    user_id: Optional[int] = None,
    method: Optional[str] = None,
    status: Optional[str] = None,
):
    base = select(GatewayCallLog)
    count_q = select(func.count(GatewayCallLog.id))
    filters = []
    if server_id:
        filters.append(GatewayCallLog.server_id == server_id)
    if user_id:
        filters.append(GatewayCallLog.user_id == user_id)
    if method:
        filters.append(GatewayCallLog.method == method)
    if status:
        filters.append(GatewayCallLog.response_status == status)
    if filters:
        base = base.where(and_(*filters))
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(
        base.order_by(desc(GatewayCallLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()
    return items, total


# --- Router endpoints ---

@stats_router.get("/stats/overview", response_model=GatewayOverview)
async def get_overview(db: AsyncSession = Depends(get_db), _=Depends(PermissionChecker(["audit_log:read"]))):
    return await _overview(db)


@stats_router.get("/stats/trend", response_model=List[GatewayTrendPoint])
async def get_trend(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    return await _trend(db, days)


@stats_router.get("/stats/top-servers", response_model=List[TopItem])
async def get_top_servers(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    return await _top_servers(db, limit)


@stats_router.get("/stats/top-tools", response_model=List[TopItem])
async def get_top_tools(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    return await _top_tools(db, limit)


@stats_router.get("/stats/top-users", response_model=List[TopItem])
async def get_top_users(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    return await _top_users(db, limit)


@stats_router.get("/stats/errors")
async def get_errors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    items, total = await _recent_errors(db, page, page_size)
    return PaginatedResponse(
        items=[GatewayErrorItem(
            id=i.id, server_namespace=i.server_namespace, method=i.method,
            error_message=i.error_message, username=i.username, created_at=i.created_at
        ) for i in items],
        total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@stats_router.get("/logs")
async def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    server_id: Optional[int] = None,
    user_id: Optional[int] = None,
    method: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(PermissionChecker(["audit_log:read"])),
):
    items, total = await _list_logs(db, page, page_size, server_id, user_id, method, status)
    return PaginatedResponse(
        items=[GatewayCallLogResponse.model_validate(i) for i in items],
        total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )
