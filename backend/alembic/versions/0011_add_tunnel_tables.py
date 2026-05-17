"""add tunnel tokens table and tunnel_enabled to servers

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reg_servers", sa.Column("tunnel_enabled", sa.Boolean(), server_default="false"))

    op.create_table(
        "tunnel_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("token_prefix", sa.String(16), nullable=False),
        sa.Column("server_id", sa.Integer(), sa.ForeignKey("reg_servers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("last_connected_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("token_hash", name="uq_tunnel_token_hash"),
    )
    op.create_index("ix_tunnel_tokens_token_hash", "tunnel_tokens", ["token_hash"])
    op.create_index("ix_tunnel_tokens_server_id", "tunnel_tokens", ["server_id"])


def downgrade() -> None:
    op.drop_table("tunnel_tokens")
    op.drop_column("reg_servers", "tunnel_enabled")
