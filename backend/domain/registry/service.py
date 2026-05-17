"""Registry service layer."""
import datetime
from typing import Optional, List
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from domain.registry.models import McpServer, McpTool, McpResource, McpPrompt, Tag, ServerVersion, server_tags

async def _get_or_create_tags(db: AsyncSession, tag_names: List[str]) -> List[Tag]:
    tags = []
    for name in [n.strip().lower() for n in tag_names if n.strip()]:
        tag = (await db.execute(select(Tag).where(Tag.name == name))).scalar_one_or_none()
        if not tag: tag = Tag(name=name); db.add(tag); await db.flush()
        tags.append(tag)
    return tags

async def create_server(db: AsyncSession, data: dict, owner_id: int, is_superadmin: bool = False) -> McpServer:
    tag_names = data.pop("tag_names", [])
    if not is_superadmin and "status" not in data:
        data["status"] = "draft"
    server = McpServer(**data, owner_id=owner_id)
    server.tags = await _get_or_create_tags(db, tag_names)
    db.add(server); await db.commit(); await db.refresh(server); return server

async def get_server(db: AsyncSession, server_id: int) -> Optional[McpServer]:
    return (await db.execute(select(McpServer).where(McpServer.id == server_id).options(
        selectinload(McpServer.tags), selectinload(McpServer.tools), selectinload(McpServer.resources),
        selectinload(McpServer.prompts), selectinload(McpServer.versions)))).scalar_one_or_none()

async def list_servers(db: AsyncSession, page: int = 1, page_size: int = 20, search: Optional[str] = None, tags: Optional[List[str]] = None, source_type: Optional[str] = None, status: Optional[str] = None):
    base = select(McpServer).options(selectinload(McpServer.tags), selectinload(McpServer.tools), selectinload(McpServer.resources), selectinload(McpServer.prompts))
    count_q = select(func.count(McpServer.id))
    if search:
        like = f"%{search}%"; filt = or_(McpServer.name.ilike(like), McpServer.namespace.ilike(like), McpServer.description.ilike(like))
        base = base.where(filt); count_q = count_q.where(filt)
    if source_type: base = base.where(McpServer.source_type == source_type); count_q = count_q.where(McpServer.source_type == source_type)
    if status: base = base.where(McpServer.status == status); count_q = count_q.where(McpServer.status == status)
    if tags: base = base.join(McpServer.tags).where(Tag.name.in_(tags)); count_q = count_q.join(server_tags, server_tags.c.server_id == McpServer.id).join(Tag).where(Tag.name.in_(tags))
    total = (await db.execute(count_q)).scalar()
    items = (await db.execute(base.order_by(McpServer.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().unique().all()
    return list(items), total

async def update_server(db: AsyncSession, server_id: int, data: dict, user_id: int, is_superadmin: bool = False) -> Optional[McpServer]:
    server = await get_server(db, server_id)
    if not server or (server.owner_id != user_id and not is_superadmin): return None
    tag_names = data.pop("tag_names", None)
    for k, v in data.items():
        if v is not None: setattr(server, k, v)
    if tag_names is not None: server.tags = await _get_or_create_tags(db, tag_names)
    server.updated_at = datetime.datetime.utcnow()
    await db.commit(); await db.refresh(server); return server

async def delete_server(db: AsyncSession, server_id: int, user_id: int, is_superadmin: bool = False) -> bool:
    server = await get_server(db, server_id)
    if not server or (server.owner_id != user_id and not is_superadmin): return False
    await db.delete(server); await db.commit(); return True

async def create_version(db: AsyncSession, server_id: int, data: dict) -> Optional[ServerVersion]:
    server = await get_server(db, server_id)
    if not server: return None
    ver = ServerVersion(server_id=server_id, **data); server.version = data["version"]
    db.add(ver); await db.commit(); await db.refresh(ver); return ver

async def get_versions(db: AsyncSession, server_id: int) -> List[ServerVersion]:
    return list((await db.execute(select(ServerVersion).where(ServerVersion.server_id == server_id).order_by(ServerVersion.published_at.desc()))).scalars().all())

async def discover_server(db: AsyncSession, server_id: int, tools: list, resources: list, prompts: list):
    server = await get_server(db, server_id)
    if not server: return None
    for t in list(server.tools): await db.delete(t)
    for r in list(server.resources): await db.delete(r)
    for p in list(server.prompts): await db.delete(p)
    await db.flush()
    for t in tools: db.add(McpTool(server_id=server_id, name=t["name"], description=t.get("description"), input_schema=t.get("inputSchema") or t.get("input_schema")))
    for r in resources: db.add(McpResource(server_id=server_id, uri_template=r.get("uriTemplate", r.get("uri_template", "")), name=r["name"], description=r.get("description"), mime_type=r.get("mimeType", r.get("mime_type"))))
    for p in prompts: db.add(McpPrompt(server_id=server_id, name=p["name"], description=p.get("description"), arguments=p.get("arguments")))
    await db.commit(); return await get_server(db, server_id)

async def list_tags(db: AsyncSession) -> List[Tag]:
    return list((await db.execute(select(Tag).order_by(Tag.name))).scalars().all())
