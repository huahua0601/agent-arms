"""add skill tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("skills",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, index=True),
        sa.Column("namespace", sa.String(256), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(64), index=True),
        sa.Column("version", sa.String(32)),
        sa.Column("author_id", sa.Integer(), nullable=False, index=True),
        sa.Column("author_name", sa.String(128)),
        sa.Column("icon_url", sa.String(512)),
        sa.Column("status", sa.String(32), index=True),
        sa.Column("is_public", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("downloads", sa.Integer(), server_default="0"),
        sa.Column("parameters", sa.JSON()),
        sa.Column("trigger_pattern", sa.String(512)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_table("skill_tag_list",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
    )
    op.create_table("skill_tags",
        sa.Column("skill_id", sa.Integer(), sa.ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("skill_tag_list.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table("skill_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("skill_id", sa.Integer(), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("changelog", sa.Text()),
        sa.Column("published_at", sa.DateTime()),
        sa.UniqueConstraint("skill_id", "version", name="uq_skill_version"),
    )


def downgrade() -> None:
    op.drop_table("skill_versions")
    op.drop_table("skill_tags")
    op.drop_table("skill_tag_list")
    op.drop_table("skills")
