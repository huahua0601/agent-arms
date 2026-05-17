"""add oauth tables and make hashed_password nullable

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("auth_users", sa.Column("auth_provider", sa.String(32), server_default="local"))
    op.add_column("auth_users", sa.Column("provider_id", sa.String(256), nullable=True))
    op.add_column("auth_users", sa.Column("provider_data", sa.JSON(), nullable=True))
    op.alter_column("auth_users", "hashed_password", existing_type=sa.String(255), nullable=True)

    op.create_table(
        "auth_oauth_connections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_user_id", sa.String(256), nullable=False),
        sa.Column("provider_username", sa.String(128), nullable=True),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("provider_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),
    )
    op.create_index("ix_oauth_user_id", "auth_oauth_connections", ["user_id"])


def downgrade() -> None:
    op.drop_table("auth_oauth_connections")
    op.drop_column("auth_users", "provider_data")
    op.drop_column("auth_users", "provider_id")
    op.drop_column("auth_users", "auth_provider")
    op.alter_column("auth_users", "hashed_password", existing_type=sa.String(255), nullable=False)
