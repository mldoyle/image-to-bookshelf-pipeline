from __future__ import annotations

from logging.config import fileConfig
from pathlib import Path

from alembic import context
from flask import current_app

config = context.config

if config.config_file_name is not None and Path(config.config_file_name).exists():
    fileConfig(config.config_file_name)


def get_engine():
    db = current_app.extensions["migrate"].db
    if hasattr(db, "engines"):
        return db.engines[None]
    return db.engine


def get_engine_url() -> str:
    return str(get_engine().url).replace("%", "%%")


def get_metadata():
    db = current_app.extensions["migrate"].db
    if hasattr(db, "metadatas"):
        return db.metadatas[None]
    return db.metadata


def run_migrations_offline() -> None:
    url = get_engine_url()
    context.configure(
        url=url,
        target_metadata=get_metadata(),
        literal_binds=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    conf_args = current_app.extensions["migrate"].configure_args
    if conf_args.get("process_revision_directives") is None:

        def process_revision_directives(context, revision, directives):
            if getattr(config.cmd_opts, "autogenerate", False):
                script = directives[0]
                if script.upgrade_ops.is_empty():
                    directives[:] = []
                    print("No changes in schema detected.")

        conf_args["process_revision_directives"] = process_revision_directives

    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            **conf_args,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
