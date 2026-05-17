"""Tunnel models — reverse connection tokens and active connection tracking."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from core.database import Base


class TunnelToken(Base):
    """A pre-shared token for a tunnel agent to authenticate its reverse connection."""
    __tablename__ = "tunnel_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    token_prefix = Column(String(16), nullable=False)
    server_id = Column(Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("auth_users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_connected_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
