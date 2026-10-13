#!/usr/bin/env bash
# Runs the full-featured FastAPI backend (real sklearn/XGBoost/SHAP) for
# local development. The deployed Netlify site instead uses the lightweight
# TypeScript functions in netlify/functions/, which read the same
# /models/*_portable.json exports - see README for why there are two runtimes.
set -euo pipefail
cd "$(dirname "$0")/.."

uvicorn backend.app.main:app --reload --port 8000
