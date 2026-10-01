#!/bin/bash
# SessionStart hook for Claude Code on the web: install npm deps so lint,
# typecheck and the node:test / vitest runners work in remote sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# .env is required by the app/tests; npm install normally generates it, but keep it explicit.
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

# `npm install` (not `npm ci`) so the cached container's node_modules is reused.
# Husky hooks are irrelevant in ephemeral containers.
HUSKY=0 npm install --no-audit --no-fund
