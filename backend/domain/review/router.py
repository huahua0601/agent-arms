"""Review API router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from middleware.auth import get_current_user
from middleware import PaginatedResponse
from domain.review import schemas as S, service as svc
from domain.team.service import get_member_role, list_user_teams

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.post("/submit", response_model=S.ReviewResponse, status_code=201)
async def submit_review(body: S.ReviewSubmit, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        review = await svc.submit_review(db, body.resource_type, body.resource_id, int(current["sub"]))
        return await svc.enrich_review(db, review)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("", response_model=PaginatedResponse[S.ReviewResponse])
async def list_reviews(
    status: Optional[str] = None, team_id: Optional[int] = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    items, total = await svc.list_reviews(db, status, team_id, page, page_size)
    enriched = [await svc.enrich_review(db, r) for r in items]
    return PaginatedResponse(
        items=enriched, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/pending-count")
async def pending_count(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    teams = await list_user_teams(db, int(current["sub"]))
    team_ids = [t.id for t in teams]
    count = await svc.get_pending_count(db, team_ids) if team_ids else 0
    return {"count": count}


@router.post("/{review_id}/approve", response_model=S.ReviewResponse)
async def approve_review(review_id: int, body: S.ReviewAction = None, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current.get("is_superadmin"):
        raise HTTPException(403, "Only superadmin can approve reviews")
    comment = body.comment if body else None
    review = await svc.approve_review(db, review_id, int(current["sub"]), comment)
    if not review:
        raise HTTPException(404, "Review not found or already processed")
    return await svc.enrich_review(db, review)


@router.post("/{review_id}/reject", response_model=S.ReviewResponse)
async def reject_review(review_id: int, body: S.ReviewAction = None, current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current.get("is_superadmin"):
        raise HTTPException(403, "Only superadmin can reject reviews")
    comment = body.comment if body else None
    review = await svc.reject_review(db, review_id, int(current["sub"]), comment)
    if not review:
        raise HTTPException(404, "Review not found or already processed")
    return await svc.enrich_review(db, review)
