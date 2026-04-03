"""initial backend schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-01 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crops",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("growth_days", sa.Integer(), nullable=False),
        sa.Column("min_rainfall_mm", sa.Float(), nullable=False),
        sa.Column("max_rainfall_mm", sa.Float(), nullable=False),
        sa.Column("min_temp_c", sa.Float(), nullable=False),
        sa.Column("max_temp_c", sa.Float(), nullable=False),
        sa.Column("planting_months", sa.JSON(), nullable=False),
        sa.Column("min_budget_per_m2", sa.Float(), nullable=False),
        sa.Column("drought_sensitive", sa.Boolean(), nullable=False),
        sa.Column("flood_sensitive", sa.Boolean(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "recommendation_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("raw_input", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "plan_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("recommendation_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("normalized_input", sa.JSON(), nullable=False),
        sa.Column("user_preferences", sa.JSON(), nullable=False),
        sa.Column("climate_output", sa.JSON(), nullable=True),
        sa.Column("eliminated_crops", sa.JSON(), nullable=False),
        sa.Column("ranked_crops", sa.JSON(), nullable=False),
        sa.Column("aggressive_plan", sa.JSON(), nullable=True),
        sa.Column("conservative_plan", sa.JSON(), nullable=True),
        sa.Column("explanation", sa.String(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("version_note", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_plan_versions_run_id", "plan_versions", ["run_id"])
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("recommendation_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("intent", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_messages_run_id", "chat_messages", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_run_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_plan_versions_run_id", table_name="plan_versions")
    op.drop_table("plan_versions")
    op.drop_table("recommendation_runs")
    op.drop_table("crops")
