"""CLI-compatible REST API for agent skill tools (OpenClaw-style)."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.storage import create_storage
from domain.gateway.auth import authenticate_gateway_request
from domain.registry.models import McpServer
from domain.skill.models import Skill
from domain.auth.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cli", tags=["CLI"])


@router.get("/search")
async def cli_search(
    q: str = Query(""),
    type: str = Query("skill", regex="^(skill|server|all)$"),
    limit: int = Query(20, ge=1, le=100),
    request=None,
    db: AsyncSession = Depends(get_db),
):
    """Public search — no auth required."""
    results = []
    like = f"%{q}%"
    if type in ("skill", "all"):
        skills = (await db.execute(
            select(Skill).where(
                Skill.status == "active", Skill.is_public == True,
                or_(Skill.name.ilike(like), Skill.namespace.ilike(like), Skill.description.ilike(like))
            ).limit(limit)
        )).scalars().all()
        for s in skills:
            results.append({
                "type": "skill", "name": s.name, "namespace": s.namespace,
                "description": s.description, "version": s.version,
                "downloads": s.downloads, "category": s.category,
            })
    if type in ("server", "all"):
        servers = (await db.execute(
            select(McpServer).where(
                McpServer.status == "active",
                or_(McpServer.name.ilike(like), McpServer.namespace.ilike(like), McpServer.description.ilike(like))
            ).limit(limit)
        )).scalars().all()
        for s in servers:
            results.append({
                "type": "server", "name": s.name, "namespace": s.namespace,
                "description": s.description, "version": s.version,
                "transport_type": s.transport_type,
            })
    return {"query": q, "count": len(results), "results": results}


@router.get("/skills/{namespace:path}/manifest")
async def skill_manifest(namespace: str, db: AsyncSession = Depends(get_db)):
    skill = (await db.execute(select(Skill).where(Skill.namespace == namespace))).scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill not found")
    return {
        "name": skill.name, "namespace": skill.namespace,
        "description": skill.description, "version": skill.version,
        "category": skill.category, "author": skill.author_name,
        "downloads": skill.downloads,
        "has_package": bool(skill.package_path),
    }


@router.get("/skills/{namespace:path}/download")
async def skill_download(namespace: str, db: AsyncSession = Depends(get_db)):
    skill = (await db.execute(select(Skill).where(Skill.namespace == namespace))).scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill not found")

    skill.downloads = (skill.downloads or 0) + 1
    await db.commit()

    if skill.package_path:
        storage = create_storage()
        try:
            data = await storage.download(skill.package_path)
            return Response(content=data, media_type="application/octet-stream",
                            headers={"Content-Disposition": f'attachment; filename="{skill.namespace.replace("/", "_")}.zip"'})
        except FileNotFoundError:
            pass

    return Response(content=skill.content.encode(), media_type="text/markdown",
                    headers={"Content-Disposition": f'attachment; filename="SKILL.md"'})


@router.get("/servers/{namespace:path}/config")
async def server_config(
    namespace: str, format: str = Query("cursor", regex="^(cursor|claude|raw)$"),
    db: AsyncSession = Depends(get_db),
):
    server = (await db.execute(select(McpServer).where(McpServer.namespace == namespace))).scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Server not found")

    if format == "cursor":
        return {
            "mcpServers": {
                server.namespace: {
                    "url": server.endpoint_url,
                    "transport": server.transport_type or "streamable-http",
                }
            }
        }
    elif format == "claude":
        return {
            "mcpServers": {
                server.name: {
                    "command": "npx",
                    "args": ["-y", server.endpoint_url],
                }
            }
        }
    else:
        return {
            "name": server.name, "namespace": server.namespace,
            "endpoint_url": server.endpoint_url,
            "transport_type": server.transport_type,
            "auth_type": server.auth_type,
        }
