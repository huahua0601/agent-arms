"""Alembic env.py — unified migration for all domains."""
import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.database import Base
from domain.auth.models import *      # noqa: F401, F403
from domain.registry.models import *  # noqa: F401, F403
from domain.runtime.models import *   # noqa: F401, F403
from domain.audit.models import *     # noqa: F401, F403
from domain.skill.models import *     # noqa: F401, F403
from domain.gateway.models import *   # noqa: F401, F403
from domain.team.models import *      # noqa: F401, F403
from domain.review.models import *    # noqa: F401, F403
from domain.tunnel.models import *    # noqa: F401, F403

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

db_url = os.getenv("SYNC_DATABASE_URL", config.get_main_option("sqlalchemy.url", ""))
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
