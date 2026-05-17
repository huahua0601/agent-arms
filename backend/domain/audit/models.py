"""Audit models."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True); username = Column(String(64), index=True)
    action = Column(String(256), nullable=False, index=True)
    resource_type = Column(String(64), nullable=False, index=True)
    resource_id = Column(String(128)); detail = Column(JSON)
    ip_address = Column(String(64)); user_agent = Column(Text)
    status = Column(String(32), default="success", index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
