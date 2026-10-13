#!/usr/bin/env bash
# One-command training pipeline: preprocess -> train/compare/calibrate ->
# metrics + SHAP + portable JS export for all 4 targets (CAD, LAD, LCX, RCA).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

echo "Training models..."
cd backend/ml
python3 train.py
