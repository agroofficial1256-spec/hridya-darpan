#!/usr/bin/env bash
# Recommended one-command demo: serves the React/R3F frontend AND the
# TypeScript prediction functions together, exactly like production.
set -euo pipefail
cd "$(dirname "$0")/.."

netlify dev --port 8889
