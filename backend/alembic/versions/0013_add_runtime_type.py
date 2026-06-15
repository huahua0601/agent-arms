"""add runtime_type column to rt_instances

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("rt_instances", sa.Column("runtime_type", sa.String(32), server_default="docker"))


def downgrade() -> None:
    op.drop_column("rt_instances", "runtime_type")
