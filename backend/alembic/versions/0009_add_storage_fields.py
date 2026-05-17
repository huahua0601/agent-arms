"""add storage fields to servers and skills

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reg_servers", sa.Column("icon_path", sa.String(512), nullable=True))
    op.add_column("skills", sa.Column("package_path", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("skills", "package_path")
    op.drop_column("reg_servers", "icon_path")
