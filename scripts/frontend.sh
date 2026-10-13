#!/usr/bin/env bash
# Starts the Vite dev server alone (expects an API on :8889, e.g. from
# `netlify dev` or scripts/dev.sh). For the full one-command experience that
# also serves the API, use scripts/dev.sh instead.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

npm install
npm run dev
