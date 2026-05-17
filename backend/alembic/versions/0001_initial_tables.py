"""initial tables — all domains

Revision ID: 0001
Revises:
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Auth
    op.create_table("auth_users",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(128)), sa.Column("avatar_url", sa.String(512)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_superadmin", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime()), sa.Column("updated_at", sa.DateTime()))
    op.create_table("auth_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.String(255)),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime()))
    op.create_table("auth_permissions",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("resource", sa.String(64), nullable=False), sa.Column("action", sa.String(64), nullable=False),
        sa.Column("description", sa.String(255)),
        sa.UniqueConstraint("resource", "action", name="uq_perm_resource_action"))
    op.create_table("auth_user_roles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("auth_role_permissions",
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("auth_roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", sa.Integer(), sa.ForeignKey("auth_permissions.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("auth_api_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False), sa.Column("key_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(16), nullable=False), sa.Column("scopes", sa.JSON()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("expires_at", sa.DateTime()), sa.Column("last_used_at", sa.DateTime()), sa.Column("created_at", sa.DateTime()))

    # Registry
    op.create_table("reg_servers",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, index=True),
        sa.Column("namespace", sa.String(256), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text()), sa.Column("version", sa.String(32)),
        sa.Column("transport_type", sa.String(32)), sa.Column("endpoint_url", sa.String(512)),
        sa.Column("source_type", sa.String(32)), sa.Column("config_schema", sa.JSON()),
        sa.Column("readme", sa.Text()), sa.Column("icon_url", sa.String(512)),
        sa.Column("owner_id", sa.Integer(), nullable=False, index=True),
        sa.Column("status", sa.String(32)), sa.Column("downloads", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime()), sa.Column("updated_at", sa.DateTime()))
    op.create_table("reg_tags", sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True), sa.Column("name", sa.String(64), nullable=False, unique=True))
    op.create_table("reg_server_tags",
        sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("reg_tags.id", ondelete="CASCADE"), primary_key=True))
    op.create_table("reg_tools", sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True), sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(128), nullable=False), sa.Column("description", sa.Text()), sa.Column("input_schema", sa.JSON()))
    op.create_table("reg_resources", sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True), sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False), sa.Column("uri_template", sa.String(512), nullable=False), sa.Column("name", sa.String(128), nullable=False), sa.Column("description", sa.Text()), sa.Column("mime_type", sa.String(128)))
    op.create_table("reg_prompts", sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True), sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(128), nullable=False), sa.Column("description", sa.Text()), sa.Column("arguments", sa.JSON()))
    op.create_table("reg_versions", sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True), sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False), sa.Column("version", sa.String(32), nullable=False), sa.Column("changelog", sa.Text()), sa.Column("config_snapshot", sa.JSON()), sa.Column("published_at", sa.DateTime()), sa.UniqueConstraint("server_id", "version", name="uq_server_version"))

    # Runtime
    op.create_table("rt_instances",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("server_id", sa.Integer(), nullable=False, index=True), sa.Column("server_name", sa.String(128)),
        sa.Column("container_id", sa.String(128)), sa.Column("status", sa.String(32)),
        sa.Column("port", sa.Integer()), sa.Column("cpu_limit", sa.String(16)), sa.Column("memory_limit", sa.String(16)),
        sa.Column("env_vars", sa.JSON()), sa.Column("image", sa.String(256)), sa.Column("command", sa.String(512)),
        sa.Column("started_at", sa.DateTime()), sa.Column("stopped_at", sa.DateTime()), sa.Column("created_at", sa.DateTime()))
    op.create_table("rt_health_checks",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("instance_id", sa.Integer(), sa.ForeignKey("rt_instances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False), sa.Column("response_time_ms", sa.Float()),
        sa.Column("detail", sa.String(512)), sa.Column("checked_at", sa.DateTime()))

    # Audit
    op.create_table("audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.Integer(), index=True), sa.Column("username", sa.String(64), index=True),
        sa.Column("action", sa.String(256), nullable=False, index=True),
        sa.Column("resource_type", sa.String(64), nullable=False, index=True),
        sa.Column("resource_id", sa.String(128)), sa.Column("detail", sa.JSON()),
        sa.Column("ip_address", sa.String(64)), sa.Column("user_agent", sa.Text()),
        sa.Column("status", sa.String(32), index=True), sa.Column("created_at", sa.DateTime(), index=True))


def downgrade() -> None:
    for t in ("audit_logs", "rt_health_checks", "rt_instances", "reg_versions", "reg_prompts", "reg_resources", "reg_tools", "reg_server_tags", "reg_tags", "reg_servers", "auth_api_keys", "auth_role_permissions", "auth_user_roles", "auth_permissions", "auth_roles", "auth_users"):
        op.drop_table(t)
