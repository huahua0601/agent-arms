"""Public Registry API — no auth required, for external agent platforms to discover and install skills.

Endpoints follow a standard package registry pattern:
  GET  /registry/v1/skills                    — search / discover
  GET  /registry/v1/skills/{namespace}        — get skill manifest by namespace
  GET  /registry/v1/skills/{namespace}/install — get SKILL.md content for installation
  GET  /registry/v1/skills/{namespace}/versions — list versions
  GET  /registry/v1/skills/{namespace}/versions/{version}/install — install specific version

Usage by agent platforms:
  curl https://your-registry.com/registry/v1/skills/ops/deploy-production/install
  => Returns raw SKILL.md content

  curl https://your-registry.com/registry/v1/skills?q=deploy&category=devops
  => Returns JSON list of matching skills
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from core.database import get_db
from domain.skill import service as svc
from domain.skill.models import Skill, SkillVersion
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import datetime

router = APIRouter(prefix="/registry/v1", tags=["public-registry"])


@router.get("/skills")
async def search_skills(
    q: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Public skill search endpoint. No auth required."""
    tag_list = [tag] if tag else None
    items, total = await svc.list_skills(db, page, page_size, q, category, tag_list, status="active", is_public=True)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "name": s.name,
                "namespace": s.namespace,
                "description": s.description,
                "category": s.category,
                "version": s.version,
                "author": s.author_name,
                "tags": [t.name for t in s.tags],
                "trigger_pattern": s.trigger_pattern,
                "downloads": s.downloads,
                "install_url": f"/registry/v1/skills/{s.namespace}/install",
                "manifest_url": f"/registry/v1/skills/{s.namespace}",
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in items
        ],
    }


@router.get("/skills/{ns:path}/install")
async def install_skill(ns: str, version: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Return raw SKILL.md content for agent installation.

    Usage:
      curl https://registry.example.com/registry/v1/skills/ops/deploy-production/install
      curl https://registry.example.com/registry/v1/skills/ops/deploy-production/install?version=1.0.0
    """
    skill = await _get_by_namespace(db, ns)
    if not skill:
        raise HTTPException(404, f"Skill '{ns}' not found")

    if version:
        ver = (await db.execute(
            select(SkillVersion).where(SkillVersion.skill_id == skill.id, SkillVersion.version == version)
        )).scalar_one_or_none()
        if not ver:
            raise HTTPException(404, f"Version '{version}' not found for skill '{ns}'")
        content = ver.content
    else:
        content = skill.content

    skill.downloads = (skill.downloads or 0) + 1
    await db.commit()

    return PlainTextResponse(content, media_type="text/markdown", headers={
        "X-Skill-Name": skill.name,
        "X-Skill-Version": skill.version,
        "X-Skill-Namespace": skill.namespace,
    })


@router.get("/skills/{ns:path}/manifest")
@router.get("/skills/{ns:path}")
async def get_manifest(ns: str, db: AsyncSession = Depends(get_db)):
    """Return skill manifest (metadata) in a standard JSON format.

    This follows a pattern similar to npm registry, suitable for tooling integration.
    """
    if ns == "categories/list":
        from domain.skill.schemas import SKILL_CATEGORIES
        return SKILL_CATEGORIES

    skill = await _get_by_namespace(db, ns)
    if not skill:
        raise HTTPException(404, f"Skill '{ns}' not found")

    versions = await svc.get_versions(db, skill.id)

    return {
        "schema_version": "1.0",
        "name": skill.name,
        "namespace": skill.namespace,
        "description": skill.description,
        "category": skill.category,
        "latest_version": skill.version,
        "author": skill.author_name,
        "status": skill.status,
        "is_public": skill.is_public,
        "downloads": skill.downloads,
        "trigger_pattern": skill.trigger_pattern,
        "parameters": skill.parameters,
        "tags": [t.name for t in skill.tags],
        "icon_url": skill.icon_url,
        "install_url": f"/registry/v1/skills/{skill.namespace}/install",
        "versions": {
            v.version: {
                "version": v.version,
                "changelog": v.changelog,
                "published_at": v.published_at.isoformat() if v.published_at else None,
                "install_url": f"/registry/v1/skills/{skill.namespace}/install?version={v.version}",
            }
            for v in versions
        },
        "created_at": skill.created_at.isoformat() if skill.created_at else None,
        "updated_at": skill.updated_at.isoformat() if skill.updated_at else None,
    }


@router.get("/skills/{ns:path}/versions")
async def list_versions(ns: str, db: AsyncSession = Depends(get_db)):
    """List all versions of a skill."""
    skill = await _get_by_namespace(db, ns)
    if not skill:
        raise HTTPException(404, f"Skill '{ns}' not found")
    versions = await svc.get_versions(db, skill.id)
    return [
        {
            "version": v.version,
            "changelog": v.changelog,
            "published_at": v.published_at.isoformat() if v.published_at else None,
            "install_url": f"/registry/v1/skills/{skill.namespace}/install?version={v.version}",
        }
        for v in versions
    ]


async def _get_by_namespace(db: AsyncSession, namespace: str) -> Optional[Skill]:
    result = await db.execute(
        select(Skill).where(Skill.namespace == namespace, Skill.is_public == True, Skill.status == "active")
        .options(selectinload(Skill.tags))
    )
    return result.scalar_one_or_none()
