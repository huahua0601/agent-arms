"""Skill API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response as RawResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.storage import create_storage
from middleware.auth import get_current_user, PermissionChecker
from middleware import PaginatedResponse
from domain.skill import schemas as S, service as svc
from domain.skill.models import Skill

router = APIRouter(prefix="/api", tags=["skills"])


@router.post("/skills", response_model=S.SkillResponse, status_code=201)
async def create_skill(body: S.SkillCreate, current=Depends(PermissionChecker(["mcp_server:create"])), db: AsyncSession = Depends(get_db)):
    return await svc.create_skill(db, body.model_dump(), author_id=int(current["sub"]), author_name=current.get("username", ""), is_superadmin=current.get("is_superadmin", False))


@router.get("/skills", response_model=PaginatedResponse[S.SkillListItem])
async def list_skills(
    page: int = 1, page_size: int = 20, search: Optional[str] = None,
    category: Optional[str] = None, tags: Optional[str] = Query(None),
    status: Optional[str] = None, is_public: Optional[bool] = None,
    current=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    items, total = await svc.list_skills(db, page, page_size, search, category, tag_list, status, is_public)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=(total+page_size-1)//page_size if total else 0)


@router.get("/skills/{skill_id}", response_model=S.SkillResponse)
async def get_skill(skill_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await svc.get_skill(db, skill_id)
    if not s: raise HTTPException(404)
    return s


@router.put("/skills/{skill_id}", response_model=S.SkillResponse)
async def update_skill(skill_id: int, body: S.SkillUpdate, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    s = await svc.update_skill(db, skill_id, body.model_dump(exclude_unset=True), int(current["sub"]), current.get("is_superadmin", False))
    if not s: raise HTTPException(404)
    return s


@router.delete("/skills/{skill_id}", status_code=204)
async def delete_skill(skill_id: int, current=Depends(PermissionChecker(["mcp_server:delete"])), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_skill(db, skill_id, int(current["sub"]), current.get("is_superadmin", False)):
        raise HTTPException(404)


@router.get("/skills/{skill_id}/versions", response_model=list[S.SkillVersionResponse])
async def get_versions(skill_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_versions(db, skill_id)


@router.post("/skills/{skill_id}/versions", response_model=S.SkillVersionResponse, status_code=201)
async def create_version(skill_id: int, body: S.VersionCreate, current=Depends(PermissionChecker(["mcp_server:update"])), db: AsyncSession = Depends(get_db)):
    ver = await svc.create_version(db, skill_id, body.model_dump())
    if not ver: raise HTTPException(404)
    return ver


@router.get("/skills/{skill_id}/content")
async def get_content(skill_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await svc.get_skill(db, skill_id)
    if not s: raise HTTPException(404)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(s.content, media_type="text/markdown")


@router.get("/skill-tags", response_model=list[S.SkillTagResponse])
async def list_tags(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_skill_tags(db)


@router.get("/skills/categories/list")
async def list_categories():
    return S.SKILL_CATEGORIES


ALLOWED_EXTENSIONS = {".md", ".json", ".yaml", ".yml", ".txt", ".xml", ".toml"}


@router.post("/skills/{skill_id}/upload")
async def upload_package(
    skill_id: int,
    file: UploadFile = File(...),
    current=Depends(PermissionChecker(["mcp_server:update"])),
    db: AsyncSession = Depends(get_db),
):
    skill = (await db.execute(select(Skill).where(Skill.id == skill_id))).scalar_one_or_none()
    if not skill:
        raise HTTPException(404)
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    ext = "." + (file.filename or "file").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    storage = create_storage()
    path = f"skills/{skill_id}/{file.filename}"
    await storage.upload(path, data, file.content_type or "application/octet-stream")
    if not skill.package_path:
        skill.package_path = f"skills/{skill_id}/"
    await db.commit()
    return {"path": path, "size": len(data)}


@router.get("/skills/{skill_id}/files")
async def list_files(skill_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    skill = (await db.execute(select(Skill).where(Skill.id == skill_id))).scalar_one_or_none()
    if not skill:
        raise HTTPException(404)
    storage = create_storage()
    files = await storage.list_files(f"skills/{skill_id}/")
    return [{"path": f, "name": f.split("/")[-1]} for f in files]


@router.get("/skills/{skill_id}/files/{file_path:path}")
async def download_file(skill_id: int, file_path: str, db: AsyncSession = Depends(get_db)):
    storage = create_storage()
    full_path = f"skills/{skill_id}/{file_path}"
    try:
        data = await storage.download(full_path)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    ct = "text/plain"
    if file_path.endswith(".json"):
        ct = "application/json"
    elif file_path.endswith((".yaml", ".yml")):
        ct = "text/yaml"
    elif file_path.endswith(".md"):
        ct = "text/markdown"
    return RawResponse(content=data, media_type=ct)
