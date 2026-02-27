#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BACKEND_DIR}"
export PYTHONPATH="${BACKEND_DIR}/src:${PYTHONPATH:-}"
export FLASK_APP="bookshelf_backend.app.factory:create_app"

flask db downgrade "$@"
