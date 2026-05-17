"""add gateway call logs table

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gw_call_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("username", sa.String(64), nullable=True),
        sa.Column("api_key_id", sa.Integer(), nullable=True),
        sa.Column("server_id", sa.Integer(), nullable=True),
        sa.Column("server_namespace", sa.String(256), nullable=True),
        sa.Column("method", sa.String(128), nullable=True),
        sa.Column("tool_name", sa.String(256), nullable=True),
        sa.Column("request_params", sa.JSON(), nullable=True),
        sa.Column("response_status", sa.String(32), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("request_size", sa.Integer(), nullable=True),
        sa.Column("response_size", sa.Integer(), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_gw_call_logs_user_id", "gw_call_logs", ["user_id"])
    op.create_index("ix_gw_call_logs_username", "gw_call_logs", ["username"])
    op.create_index("ix_gw_call_logs_api_key_id", "gw_call_logs", ["api_key_id"])
    op.create_index("ix_gw_call_logs_server_id", "gw_call_logs", ["server_id"])
    op.create_index("ix_gw_call_logs_server_namespace", "gw_call_logs", ["server_namespace"])
    op.create_index("ix_gw_call_logs_method", "gw_call_logs", ["method"])
    op.create_index("ix_gw_call_logs_tool_name", "gw_call_logs", ["tool_name"])
    op.create_index("ix_gw_call_logs_response_status", "gw_call_logs", ["response_status"])
    op.create_index("ix_gw_call_logs_created_at", "gw_call_logs", ["created_at"])
    op.create_index("ix_gw_call_logs_created_status", "gw_call_logs", ["created_at", "response_status"])
    op.create_index("ix_gw_call_logs_server_created", "gw_call_logs", ["server_id", "created_at"])
    op.create_index("ix_gw_call_logs_user_created", "gw_call_logs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("gw_call_logs")
