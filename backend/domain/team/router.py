"""Team API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from middleware.auth import get_current_user
from middleware import PaginatedResponse
from domain.team import schemas as S, service as svc
from domain.team.models import TeamMember
from domain.auth.models import User

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _team_response(team) -> S.TeamResponse:
    return S.TeamResponse(
        id=team.id, slug=team.slug, display_name=team.display_name,
        description=team.description, avatar_url=team.avatar_url,
        is_personal=team.is_personal, require_review=team.require_review or False,
        created_by=team.created_by,
        member_count=len(team.members) if hasattr(team, "members") and team.members else 0,
        created_at=team.created_at, updated_at=team.updated_at,
    )


async def _team_detail(team, db: AsyncSession) -> S.TeamDetailResponse:
    members = []
    for m in (team.members or []):
        user = (await db.execute(select(User).where(User.id == m.user_id))).scalar_one_or_none()
        members.append(S.TeamMemberResponse(
            id=m.id, user_id=m.user_id,
            username=user.username if user else "",
            display_name=user.display_name if user else None,
            avatar_url=user.avatar_url if user else None,
            role=m.role, joined_at=m.joined_at,
        ))
    return S.TeamDetailResponse(
        id=team.id, slug=team.slug, display_name=team.display_name,
        description=team.description, avatar_url=team.avatar_url,
        is_personal=team.is_personal, require_review=team.require_review or False,
        created_by=team.created_by,
        member_count=len(members), members=members,
        created_at=team.created_at, updated_at=team.updated_at,
    )


@router.post("", response_model=S.TeamResponse, status_code=201)
async def create_team(body: S.TeamCreate, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.create_team(db, body.model_dump(), int(current["sub"]))
    return _team_response(team)


@router.get("", response_model=PaginatedResponse[S.TeamResponse])
async def list_teams(
    page: int = 1, page_size: int = 20, search: Optional[str] = None,
    mine: bool = False,
    current=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if mine:
        teams = await svc.list_user_teams(db, int(current["sub"]))
        return PaginatedResponse(
            items=[_team_response(t) for t in teams],
            total=len(teams), page=1, page_size=len(teams) or 20, pages=1,
        )
    items, total = await svc.list_all_teams(db, page, page_size, search)
    return PaginatedResponse(
        items=[_team_response(t) for t in items],
        total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/{slug}", response_model=S.TeamDetailResponse)
async def get_team(slug: str, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    return await _team_detail(team, db)


@router.put("/{slug}", response_model=S.TeamResponse)
async def update_team(slug: str, body: S.TeamUpdate, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    role = await svc.get_member_role(db, team.id, int(current["sub"]))
    if role not in ("owner", "admin") and not current.get("is_superadmin"):
        raise HTTPException(403, "Only team owner/admin can update")
    updated = await svc.update_team(db, slug, body.model_dump(exclude_unset=True))
    return _team_response(updated)


@router.delete("/{slug}", status_code=204)
async def delete_team(slug: str, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    if team.is_personal:
        raise HTTPException(400, "Cannot delete personal namespace")
    role = await svc.get_member_role(db, team.id, int(current["sub"]))
    if role != "owner" and not current.get("is_superadmin"):
        raise HTTPException(403)
    if not await svc.delete_team(db, slug):
        raise HTTPException(400)


@router.post("/{slug}/members", status_code=201)
async def add_member(slug: str, body: S.AddMemberRequest, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    role = await svc.get_member_role(db, team.id, int(current["sub"]))
    if role not in ("owner", "admin") and not current.get("is_superadmin"):
        raise HTTPException(403)
    m = await svc.add_member(db, team.id, body.user_id, body.role)
    return {"id": m.id, "user_id": m.user_id, "role": m.role}


@router.put("/{slug}/members/{user_id}")
async def update_member(slug: str, user_id: int, body: S.UpdateMemberRequest, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    role = await svc.get_member_role(db, team.id, int(current["sub"]))
    if role != "owner" and not current.get("is_superadmin"):
        raise HTTPException(403, "Only owner can change roles")
    if not await svc.update_member_role(db, team.id, user_id, body.role):
        raise HTTPException(404)
    return {"ok": True}


@router.delete("/{slug}/members/{user_id}", status_code=204)
async def remove_member(slug: str, user_id: int, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    team = await svc.get_team(db, slug)
    if not team:
        raise HTTPException(404)
    role = await svc.get_member_role(db, team.id, int(current["sub"]))
    if role not in ("owner", "admin") and not current.get("is_superadmin"):
        raise HTTPException(403)
    if not await svc.remove_member(db, team.id, user_id):
        raise HTTPException(400, "Cannot remove owner")
