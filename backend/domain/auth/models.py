"""Auth models — all in public schema with 'auth_' prefix."""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from core.database import Base

user_roles = Table(
    "auth_user_roles", Base.metadata,
    Column("user_id", Integer, ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
)

role_permissions = Table(
    "auth_role_permissions", Base.metadata,
    Column("role_id", Integer, ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("auth_permissions.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "auth_users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    display_name = Column(String(128))
    avatar_url = Column(String(512))
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    auth_provider = Column(String(32), default="local")
    provider_id = Column(String(256))
    provider_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="selectin")
    api_keys = relationship("ApiKey", back_populates="user", lazy="selectin", cascade="all, delete-orphan")
    oauth_connections = relationship("OAuthConnection", back_populates="user", lazy="selectin", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "auth_roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(String(255))
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    users = relationship("User", secondary=user_roles, back_populates="roles", lazy="selectin")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles", lazy="selectin")


class Permission(Base):
    __tablename__ = "auth_permissions"
    __table_args__ = (UniqueConstraint("resource", "action", name="uq_perm_resource_action"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    description = Column(String(255))
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions", lazy="selectin")


class ApiKey(Base):
    __tablename__ = "auth_api_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    key_prefix = Column(String(16), nullable=False)
    scopes = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime)
    last_used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="api_keys")


class OAuthConnection(Base):
    __tablename__ = "auth_oauth_connections"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(32), nullable=False)
    provider_user_id = Column(String(256), nullable=False)
    provider_username = Column(String(128))
    provider_email = Column(String(255))
    provider_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="oauth_connections")
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),)
