"""Review service."""
import datetime
from typing import Optional, List
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from domain.review.models import ReviewRequest
from domain.team.models import Team, TeamMember
from domain.registry.models import McpServer
from domain.skill.models import Skill
from domain.auth.models import User


async def submit_review(db: AsyncSession, resource_type: str, resource_id: int, submitter_id: int) -> ReviewRequest:
    if resource_type == "server":
        resource = (await db.execute(select(McpServer).where(McpServer.id == resource_id))).scalar_one_or_none()
        if not resource:
            raise ValueError("Server not found")
        team_id = resource.team_id or 0
        resource.status = "pending_review"
    elif resource_type == "skill":
        resource = (await db.execute(select(Skill).where(Skill.id == resource_id))).scalar_one_or_none()
        if not resource:
            raise ValueError("Skill not found")
        team_id = resource.team_id or 0
        resource.status = "pending_review"
    else:
        raise ValueError(f"Invalid resource type: {resource_type}")

    review = ReviewRequest(
        resource_type=resource_type, resource_id=resource_id,
        team_id=team_id, submitter_id=submitter_id, status="pending",
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


async def approve_review(db: AsyncSession, review_id: int, reviewer_id: int, comment: Optional[str] = None) -> Optional[ReviewRequest]:
    review = (await db.execute(select(ReviewRequest).where(ReviewRequest.id == review_id))).scalar_one_or_none()
    if not review or review.status != "pending":
        return None
    review.status = "approved"
    review.reviewer_id = reviewer_id
    review.review_comment = comment
    review.reviewed_at = datetime.datetime.utcnow()

    if review.resource_type == "server":
        srv = (await db.execute(select(McpServer).where(McpServer.id == review.resource_id))).scalar_one_or_none()
        if srv:
            srv.status = "active"
    elif review.resource_type == "skill":
        skill = (await db.execute(select(Skill).where(Skill.id == review.resource_id))).scalar_one_or_none()
        if skill:
            skill.status = "active"
            skill.is_public = True

    await db.commit()
    await db.refresh(review)
    return review


async def reject_review(db: AsyncSession, review_id: int, reviewer_id: int, comment: Optional[str] = None) -> Optional[ReviewRequest]:
    review = (await db.execute(select(ReviewRequest).where(ReviewRequest.id == review_id))).scalar_one_or_none()
    if not review or review.status != "pending":
        return None
    review.status = "rejected"
    review.reviewer_id = reviewer_id
    review.review_comment = comment
    review.reviewed_at = datetime.datetime.utcnow()

    if review.resource_type == "server":
        srv = (await db.execute(select(McpServer).where(McpServer.id == review.resource_id))).scalar_one_or_none()
        if srv:
            srv.status = "rejected"
    elif review.resource_type == "skill":
        skill = (await db.execute(select(Skill).where(Skill.id == review.resource_id))).scalar_one_or_none()
        if skill:
            skill.status = "rejected"

    await db.commit()
    await db.refresh(review)
    return review


async def list_reviews(
    db: AsyncSession, status: Optional[str] = None, team_id: Optional[int] = None,
    page: int = 1, page_size: int = 20
):
    base = select(ReviewRequest)
    count_q = select(func.count(ReviewRequest.id))
    if status:
        base = base.where(ReviewRequest.status == status)
        count_q = count_q.where(ReviewRequest.status == status)
    if team_id:
        base = base.where(ReviewRequest.team_id == team_id)
        count_q = count_q.where(ReviewRequest.team_id == team_id)
    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(
        base.order_by(desc(ReviewRequest.submitted_at)).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    return list(items), total


async def get_pending_count(db: AsyncSession, team_ids: List[int] = None) -> int:
    q = select(func.count(ReviewRequest.id)).where(ReviewRequest.status == "pending")
    if team_ids:
        q = q.where(ReviewRequest.team_id.in_(team_ids))
    return (await db.execute(q)).scalar() or 0


async def enrich_review(db: AsyncSession, review: ReviewRequest) -> dict:
    """Add resource_name, team_slug, submitter_name, reviewer_name."""
    resource_name = None
    if review.resource_type == "server":
        srv = (await db.execute(select(McpServer).where(McpServer.id == review.resource_id))).scalar_one_or_none()
        resource_name = srv.name if srv else None
    elif review.resource_type == "skill":
        skill = (await db.execute(select(Skill).where(Skill.id == review.resource_id))).scalar_one_or_none()
        resource_name = skill.name if skill else None
    team = (await db.execute(select(Team).where(Team.id == review.team_id))).scalar_one_or_none()
    submitter = (await db.execute(select(User).where(User.id == review.submitter_id))).scalar_one_or_none()
    reviewer = None
    if review.reviewer_id:
        reviewer = (await db.execute(select(User).where(User.id == review.reviewer_id))).scalar_one_or_none()
    return {
        "id": review.id, "resource_type": review.resource_type, "resource_id": review.resource_id,
        "resource_name": resource_name,
        "team_id": review.team_id, "team_slug": team.slug if team else None,
        "submitter_id": review.submitter_id, "submitter_name": submitter.username if submitter else None,
        "status": review.status,
        "reviewer_id": review.reviewer_id, "reviewer_name": reviewer.username if reviewer else None,
        "review_comment": review.review_comment,
        "submitted_at": review.submitted_at, "reviewed_at": review.reviewed_at,
    }
