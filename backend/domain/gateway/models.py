"""Gateway call log models."""
import datetime
from sqlalchemy import Column, BigInteger, Integer, String, DateTime, JSON, Text, Float, Index
from core.database import Base


class GatewayCallLog(Base):
    __tablename__ = "gw_call_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, index=True)
    username = Column(String(64), index=True)
    api_key_id = Column(Integer, index=True)
    server_id = Column(Integer, index=True)
    server_namespace = Column(String(256), index=True)
    method = Column(String(128), index=True)
    tool_name = Column(String(256), index=True)
    request_params = Column(JSON)
    response_status = Column(String(32), index=True)
    error_message = Column(Text)
    latency_ms = Column(Float)
    request_size = Column(Integer)
    response_size = Column(Integer)
    ip_address = Column(String(64))
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_gw_call_logs_created_status", "created_at", "response_status"),
        Index("ix_gw_call_logs_server_created", "server_id", "created_at"),
        Index("ix_gw_call_logs_user_created", "user_id", "created_at"),
    )
