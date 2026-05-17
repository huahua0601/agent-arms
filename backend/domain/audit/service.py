"""Audit service layer."""
import csv, io, datetime
from typing import Optional
from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from domain.audit.models import AuditLog


async def create_log(db: AsyncSession, **kwargs):
    db.add(AuditLog(**kwargs))
    await db.commit()


async def list_logs(db: AsyncSession, page=1, page_size=50, user_id=None, username=None, action=None, resource_type=None, status=None, date_from=None, date_to=None):
    base = select(AuditLog); count_q = select(func.count(AuditLog.id)); filters = []
    if user_id: filters.append(AuditLog.user_id == user_id)
    if username: filters.append(AuditLog.username.ilike(f"%{username}%"))
    if action: filters.append(AuditLog.action.ilike(f"%{action}%"))
    if resource_type: filters.append(AuditLog.resource_type == resource_type)
    if status: filters.append(AuditLog.status == status)
    if date_from: filters.append(AuditLog.created_at >= datetime.datetime.fromisoformat(date_from))
    if date_to: filters.append(AuditLog.created_at <= datetime.datetime.fromisoformat(date_to))
    if filters: base = base.where(and_(*filters)); count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar()
    items = (await db.execute(base.order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size))).scalars().all()
    return list(items), total


async def get_stats(db: AsyncSession) -> dict:
    today = datetime.date.today()
    total = (await db.execute(select(func.count(AuditLog.id)))).scalar()
    today_count = (await db.execute(select(func.count(AuditLog.id)).where(cast(AuditLog.created_at, Date) == today))).scalar()
    success = (await db.execute(select(func.count(AuditLog.id)).where(AuditLog.status == "success"))).scalar()
    failure = (await db.execute(select(func.count(AuditLog.id)).where(AuditLog.status == "failure"))).scalar()
    top_users = [{"username": r[0], "count": r[1]} for r in (await db.execute(select(AuditLog.username, func.count(AuditLog.id).label("c")).where(AuditLog.username.isnot(None)).group_by(AuditLog.username).order_by(func.count(AuditLog.id).desc()).limit(5))).all()]
    top_actions = [{"action": r[0], "count": r[1]} for r in (await db.execute(select(AuditLog.action, func.count(AuditLog.id).label("c")).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10))).all()]
    return {"total_events": total, "today_events": today_count, "success_count": success, "failure_count": failure, "top_users": top_users, "top_actions": top_actions}


async def export_csv(db: AsyncSession, **kwargs) -> str:
    items, _ = await list_logs(db, page=1, page_size=10000, **kwargs)
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(["id","user_id","username","action","resource_type","resource_id","status","ip_address","created_at"])
    for l in items: w.writerow([l.id, l.user_id, l.username, l.action, l.resource_type, l.resource_id, l.status, l.ip_address, l.created_at.isoformat()])
    return out.getvalue()
