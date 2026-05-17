"""add review requests table

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "review_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("submitter_id", sa.Integer(), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("auth_users.id"), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_review_status", "review_requests", ["status"])
    op.create_index("ix_review_team", "review_requests", ["team_id"])
    op.create_index("ix_review_resource", "review_requests", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_table("review_requests")
