"""add measurement sessions

Revision ID: 0002_measurement_sessions
Revises: 0001_initial
Create Date: 2026-04-05 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_measurement_sessions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "measurement_sessions",
        sa.Column("session_id", sa.String(length=128), primary_key=True),
        sa.Column("plant_id", sa.String(length=100), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("measurement_sessions")
