"""remove team tables and team_id columns

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_review_team", table_name="review_requests")
    op.drop_column("review_requests", "team_id")
    op.drop_column("reg_servers", "team_id")
    op.drop_column("skills", "team_id")
    op.drop_table("team_members")
    op.drop_table("teams")


def downgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(64), unique=True, nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("is_personal", sa.Boolean(), server_default="false"),
        sa.Column("require_review", sa.Boolean(), server_default="false"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(32), server_default="member"),
        sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_user"),
    )
    op.add_column("reg_servers", sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=True))
    op.add_column("skills", sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=True))
    op.add_column("review_requests", sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=True))
    op.create_index("ix_review_team", "review_requests", ["team_id"])
