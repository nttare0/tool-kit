#!/bin/bash
set -e
pnpm install --frozen-lockfile
# The Toolstack app uses SQLite by default and does not require DATABASE_URL.
# `pnpm --filter db push` is for the unused Postgres workspace package.
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter db push
else
  echo "Skipping db push — DATABASE_URL not set (Toolstack uses SQLite)."
fi
