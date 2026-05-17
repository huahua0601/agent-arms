"""Team service layer."""
import datetime
from typing import Optional, List, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from domain.team.models import Team, TeamMember
from domain.auth.models import User


async def create_team(db: AsyncSession, data: dict, creator_id: int) -> Team:
    team = Team(
        slug=data["slug"], display_name=data["display_name"],
        description=data.get("description"), avatar_url=data.get("avatar_url"),
        created_by=creator_id,
    )
    db.add(team)
    await db.flush()
    member = TeamMember(team_id=team.id, user_id=creator_id, role="owner")
    db.add(member)
    await db.commit()
    await db.refresh(team)
    return team


async def create_personal_team(db: AsyncSession, user: User) -> Team:
    existing = (await db.execute(select(Team).where(Team.slug == user.username, Team.is_personal == True))).scalar_one_or_none()
    if existing:
        return existing
    team = Team(
        slug=user.username, display_name=user.display_name or user.username,
        is_personal=True, created_by=user.id,
    )
    db.add(team)
    await db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role="owner"))
    await db.commit()
    await db.refresh(team)
    return team


async def get_team(db: AsyncSession, slug: str) -> Optional[Team]:
    return (await db.execute(
        select(Team).where(Team.slug == slug).options(selectinload(Team.members))
    )).scalar_one_or_none()


async def list_user_teams(db: AsyncSession, user_id: int) -> List[Team]:
    result = await db.execute(
        select(Team).join(TeamMember).where(TeamMember.user_id == user_id).order_by(Team.slug)
    )
    return list(result.scalars().all())


async def list_all_teams(db: AsyncSession, page: int = 1, page_size: int = 20, search: Optional[str] = None):
    base = select(Team)
    count_q = select(func.count(Team.id))
    if search:
        like = f"%{search}%"
        filt = Team.slug.ilike(like) | Team.display_name.ilike(like)
        base = base.where(filt)
        count_q = count_q.where(filt)
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(
        base.order_by(Team.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return list(items), total


async def update_team(db: AsyncSession, slug: str, data: dict) -> Optional[Team]:
    team = await get_team(db, slug)
    if not team:
        return None
    for k, v in data.items():
        if v is not None and hasattr(team, k):
            setattr(team, k, v)
    team.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(team)
    return team


async def delete_team(db: AsyncSession, slug: str) -> bool:
    team = await get_team(db, slug)
    if not team or team.is_personal:
        return False
    await db.delete(team)
    await db.commit()
    return True


async def get_member_role(db: AsyncSession, team_id: int, user_id: int) -> Optional[str]:
    m = (await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )).scalar_one_or_none()
    return m.role if m else None


async def add_member(db: AsyncSession, team_id: int, user_id: int, role: str = "member") -> TeamMember:
    m = TeamMember(team_id=team_id, user_id=user_id, role=role)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


async def update_member_role(db: AsyncSession, team_id: int, user_id: int, role: str) -> bool:
    m = (await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )).scalar_one_or_none()
    if not m:
        return False
    m.role = role
    await db.commit()
    return True


async def remove_member(db: AsyncSession, team_id: int, user_id: int) -> bool:
    m = (await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )).scalar_one_or_none()
    if not m or m.role == "owner":
        return False
    await db.delete(m)
    await db.commit()
    return True
