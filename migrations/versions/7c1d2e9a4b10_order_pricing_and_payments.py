"""order priority/pricing columns and payments table

The initial migration predates these model changes, so a fresh
`alembic upgrade head` produced a schema without them. Idempotent: databases
built from scripts/local_postgres_migration.sql already have them.

Revision ID: 7c1d2e9a4b10
Revises: 05e4387f16b8
Create Date: 2026-10-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7c1d2e9a4b10'
down_revision: Union[str, Sequence[str], None] = '05e4387f16b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ORDER_COLUMNS = [
    sa.Column(
        'priority',
        sa.Enum('low', 'normal', 'high', 'urgent', name='orderpriority'),
        nullable=False,
        server_default='normal',
    ),
    sa.Column('weight_kg', sa.Float(), nullable=True),
    sa.Column('distance_km', sa.Float(), nullable=True),
    sa.Column('rate_per_km', sa.Float(), nullable=True),
    sa.Column('rate_per_kg', sa.Float(), nullable=True),
    sa.Column('base_fee', sa.Float(), nullable=True),
    sa.Column('handling_fee', sa.Float(), nullable=True),
    sa.Column('amount', sa.Float(), nullable=True),
    sa.Column('currency', sa.String(length=10), nullable=True),
    sa.Column('pricing_formula', sa.String(length=500), nullable=True),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    existing = {c['name'] for c in inspector.get_columns('orders')}
    for column in ORDER_COLUMNS:
        if column.name not in existing:
            if column.name == 'priority':
                column.type.create(op.get_bind(), checkfirst=True)
            op.add_column('orders', column)

    if 'payments' not in inspector.get_table_names():
        op.create_table(
            'payments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('order_id', sa.Integer(), nullable=False),
            sa.Column('customer_user_id', sa.Integer(), nullable=True),
            sa.Column('amount', sa.Float(), nullable=False),
            sa.Column('currency', sa.String(length=10), nullable=False),
            sa.Column(
                'method',
                sa.Enum('safepay', 'cod', 'card', name='paymentmethod'),
                nullable=False,
            ),
            sa.Column('provider', sa.String(length=50), nullable=True),
            sa.Column('provider_payment_id', sa.String(length=100), nullable=True),
            sa.Column('checkout_url', sa.String(length=1000), nullable=True),
            sa.Column(
                'status',
                sa.Enum(
                    'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded',
                    name='paymentstatus',
                ),
                nullable=False,
            ),
            sa.Column('message', sa.String(length=500), nullable=True),
            sa.Column('description', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
            sa.ForeignKeyConstraint(['customer_user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_payments_order_id', 'payments', ['order_id'])

    payment_indexes = {i['name'] for i in sa.inspect(op.get_bind()).get_indexes('payments')}
    if 'ix_payments_provider_payment_id' not in payment_indexes:
        # SafePay webhooks look payments up by tracker token
        op.create_index('ix_payments_provider_payment_id', 'payments', ['provider_payment_id'])


def downgrade() -> None:
    op.drop_index('ix_payments_provider_payment_id', table_name='payments')
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.drop_table('payments')
    sa.Enum(name='paymentstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='paymentmethod').drop(op.get_bind(), checkfirst=True)
    for column in reversed(ORDER_COLUMNS):
        op.drop_column('orders', column.name)
    sa.Enum(name='orderpriority').drop(op.get_bind(), checkfirst=True)
