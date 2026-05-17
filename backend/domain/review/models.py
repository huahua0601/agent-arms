"""Review / governance models."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from core.database import Base


class ReviewRequest(Base):
    __tablename__ = "review_requests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_type = Column(String(32), nullable=False, index=True)
    resource_id = Column(Integer, nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    submitter_id = Column(Integer, ForeignKey("auth_users.id"), nullable=False)
    status = Column(String(32), default="pending", index=True)
    reviewer_id = Column(Integer, ForeignKey("auth_users.id"))
    review_comment = Column(Text)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_at = Column(DateTime)
