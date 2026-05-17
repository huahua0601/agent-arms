"""Runtime models."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from core.database import Base

class Instance(Base):
    __tablename__ = "rt_instances"
    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False, index=True)
    server_name = Column(String(128)); container_id = Column(String(128))
    status = Column(String(32), default="pending"); port = Column(Integer)
    cpu_limit = Column(String(16), default="0.5"); memory_limit = Column(String(16), default="256m")
    env_vars = Column(JSON); image = Column(String(256)); command = Column(String(512))
    started_at = Column(DateTime); stopped_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    health_checks = relationship("HealthCheck", back_populates="instance", lazy="selectin", cascade="all, delete-orphan")

class HealthCheck(Base):
    __tablename__ = "rt_health_checks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    instance_id = Column(Integer, ForeignKey("rt_instances.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), nullable=False)
    response_time_ms = Column(Float); detail = Column(String(512))
    checked_at = Column(DateTime, default=datetime.datetime.utcnow)
    instance = relationship("Instance", back_populates="health_checks")
