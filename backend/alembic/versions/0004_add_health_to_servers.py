"""add health fields to reg_servers

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reg_servers", sa.Column("health_status", sa.String(32), server_default="unknown"))
    op.add_column("reg_servers", sa.Column("last_health_check", sa.DateTime(), nullable=True))
    op.add_column("reg_servers", sa.Column("health_latency_ms", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("reg_servers", "health_latency_ms")
    op.drop_column("reg_servers", "last_health_check")
    op.drop_column("reg_servers", "health_status")
