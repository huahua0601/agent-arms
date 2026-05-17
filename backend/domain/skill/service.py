"""Skill service layer."""
import datetime
from typing import Optional, List
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from domain.skill.models import Skill, SkillTag, SkillVersion, skill_tags


async def _get_or_create_tags(db: AsyncSession, names: List[str]) -> List[SkillTag]:
    tags = []
    for name in [n.strip().lower() for n in names if n.strip()]:
        tag = (await db.execute(select(SkillTag).where(SkillTag.name == name))).scalar_one_or_none()
        if not tag:
            tag = SkillTag(name=name); db.add(tag); await db.flush()
        tags.append(tag)
    return tags


async def create_skill(db: AsyncSession, data: dict, author_id: int, author_name: str, is_superadmin: bool = False) -> Skill:
    tag_names = data.pop("tag_names", [])
    if not is_superadmin:
        data["status"] = "draft"
        data["is_public"] = False
    skill = Skill(**data, author_id=author_id, author_name=author_name)
    skill.tags = await _get_or_create_tags(db, tag_names)
    db.add(skill)
    ver = SkillVersion(skill=skill, version=data.get("version", "1.0.0"), content=data["content"], changelog="Initial version")
    db.add(ver)
    await db.commit(); await db.refresh(skill); return skill


async def get_skill(db: AsyncSession, skill_id: int) -> Optional[Skill]:
    return (await db.execute(select(Skill).where(Skill.id == skill_id).options(
        selectinload(Skill.tags), selectinload(Skill.versions)))).scalar_one_or_none()


async def list_skills(db: AsyncSession, page=1, page_size=20, search=None, category=None, tags=None, status=None, is_public=None):
    base = select(Skill).options(selectinload(Skill.tags))
    count_q = select(func.count(Skill.id))
    if search:
        like = f"%{search}%"
        filt = or_(Skill.name.ilike(like), Skill.namespace.ilike(like), Skill.description.ilike(like))
        base = base.where(filt); count_q = count_q.where(filt)
    if category:
        base = base.where(Skill.category == category); count_q = count_q.where(Skill.category == category)
    if status:
        base = base.where(Skill.status == status); count_q = count_q.where(Skill.status == status)
    if is_public is not None:
        base = base.where(Skill.is_public == is_public); count_q = count_q.where(Skill.is_public == is_public)
    if tags:
        base = base.join(Skill.tags).where(SkillTag.name.in_(tags))
        count_q = count_q.join(skill_tags, skill_tags.c.skill_id == Skill.id).join(SkillTag).where(SkillTag.name.in_(tags))
    total = (await db.execute(count_q)).scalar()
    items = (await db.execute(base.order_by(Skill.updated_at.desc()).offset((page-1)*page_size).limit(page_size))).scalars().unique().all()
    return list(items), total


async def update_skill(db: AsyncSession, skill_id: int, data: dict, user_id: int, is_superadmin=False) -> Optional[Skill]:
    skill = await get_skill(db, skill_id)
    if not skill or (skill.author_id != user_id and not is_superadmin):
        return None
    tag_names = data.pop("tag_names", None)
    for k, v in data.items():
        if v is not None: setattr(skill, k, v)
    if tag_names is not None:
        skill.tags = await _get_or_create_tags(db, tag_names)
    skill.updated_at = datetime.datetime.utcnow()
    await db.commit(); await db.refresh(skill); return skill


async def delete_skill(db: AsyncSession, skill_id: int, user_id: int, is_superadmin=False) -> bool:
    skill = await get_skill(db, skill_id)
    if not skill or (skill.author_id != user_id and not is_superadmin):
        return False
    await db.delete(skill); await db.commit(); return True


async def create_version(db: AsyncSession, skill_id: int, data: dict) -> Optional[SkillVersion]:
    skill = await get_skill(db, skill_id)
    if not skill: return None
    ver = SkillVersion(skill_id=skill_id, version=data["version"], content=data["content"], changelog=data.get("changelog"))
    skill.version = data["version"]
    skill.content = data["content"]
    db.add(ver); await db.commit(); await db.refresh(ver); return ver


async def get_versions(db: AsyncSession, skill_id: int) -> List[SkillVersion]:
    return list((await db.execute(select(SkillVersion).where(SkillVersion.skill_id == skill_id).order_by(SkillVersion.published_at.desc()))).scalars().all())


async def list_skill_tags(db: AsyncSession) -> List[SkillTag]:
    return list((await db.execute(select(SkillTag).order_by(SkillTag.name))).scalars().all())
