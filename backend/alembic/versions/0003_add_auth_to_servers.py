"""add auth fields to reg_servers

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reg_servers", sa.Column("auth_type", sa.String(32), server_default="none"))
    op.add_column("reg_servers", sa.Column("auth_config", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("reg_servers", "auth_config")
    op.drop_column("reg_servers", "auth_type")
