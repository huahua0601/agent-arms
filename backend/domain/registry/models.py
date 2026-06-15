"""Registry models."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Text, JSON, UniqueConstraint, Float, Boolean
from sqlalchemy.orm import relationship
from core.database import Base

server_tags = Table("reg_server_tags", Base.metadata,
    Column("server_id", Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("reg_tags.id", ondelete="CASCADE"), primary_key=True))

class McpServer(Base):
    __tablename__ = "reg_servers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, index=True)
    namespace = Column(String(256), unique=True, nullable=False, index=True)
    description = Column(Text); version = Column(String(32), default="0.1.0")
    transport_type = Column(String(32), default="stdio"); endpoint_url = Column(String(512))
    source_type = Column(String(32), default="external"); config_schema = Column(JSON)
    auth_type = Column(String(32), default="none")
    auth_config = Column(JSON)
    openapi_spec = Column(JSON)
    tunnel_enabled = Column(Boolean, default=False)
    health_status = Column(String(32), default="unknown")
    last_health_check = Column(DateTime)
    health_latency_ms = Column(Float)
    readme = Column(Text); icon_url = Column(String(512))
    icon_path = Column(String(512))
    owner_id = Column(Integer, nullable=False, index=True)
    status = Column(String(32), default="active"); downloads = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    tags = relationship("Tag", secondary=server_tags, back_populates="servers", lazy="selectin")
    tools = relationship("McpTool", back_populates="server", lazy="selectin", cascade="all, delete-orphan")
    resources = relationship("McpResource", back_populates="server", lazy="selectin", cascade="all, delete-orphan")
    prompts = relationship("McpPrompt", back_populates="server", lazy="selectin", cascade="all, delete-orphan")
    versions = relationship("ServerVersion", back_populates="server", lazy="selectin", cascade="all, delete-orphan")

class McpTool(Base):
    __tablename__ = "reg_tools"
    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False); description = Column(Text); input_schema = Column(JSON)
    server = relationship("McpServer", back_populates="tools")

class McpResource(Base):
    __tablename__ = "reg_resources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False)
    uri_template = Column(String(512), nullable=False); name = Column(String(128), nullable=False)
    description = Column(Text); mime_type = Column(String(128))
    server = relationship("McpServer", back_populates="resources")

class McpPrompt(Base):
    __tablename__ = "reg_prompts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False); description = Column(Text); arguments = Column(JSON)
    server = relationship("McpServer", back_populates="prompts")

class Tag(Base):
    __tablename__ = "reg_tags"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    servers = relationship("McpServer", secondary=server_tags, back_populates="tags")

class ServerVersion(Base):
    __tablename__ = "reg_versions"
    __table_args__ = (UniqueConstraint("server_id", "version", name="uq_server_version"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(32), nullable=False); changelog = Column(Text); config_snapshot = Column(JSON)
    published_at = Column(DateTime, default=datetime.datetime.utcnow)
    server = relationship("McpServer", back_populates="versions")
