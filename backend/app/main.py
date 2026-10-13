"""FastAPI backend serving the cardiovascular risk pipeline.

Run: uvicorn backend.app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, create_model

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "models"
sys.path.insert(0, str(ROOT / "backend" / "ml"))
from preprocess import load_config  # noqa: E402

CONFIG = load_config()
SCHEMA = json.loads((MODELS_DIR / "schema.json").read_text())
METRICS = json.loads((MODELS_DIR / "metrics.json").read_text())
GLOBAL_IMPORTANCE = {
    t["id"]: json.loads((MODELS_DIR / f"{t['id']}_shap_global.json").read_text())
    for t in CONFIG["targets"]
}

PIPELINES: dict[str, Any] = {}
EXPLAINERS: dict[str, Any] = {}
for t in CONFIG["targets"]:
    bundle = joblib.load(MODELS_DIR / f"{t['id']}_pipeline.joblib")
    PIPELINES[t["id"]] = bundle
    base = bundle["model"].calibrated_classifiers_[0].estimator
    if bundle["model_kind"] == "logreg":
        EXPLAINERS[t["id"]] = shap.LinearExplainer(base, np.zeros((1, len(bundle["preprocessor"].feature_names()))))
    else:
        EXPLAINERS[t["id"]] = shap.TreeExplainer(base)


def _field_type(f: dict):
    if f["type"] == "number":
        return (float, Field(default=f["default"]))
    if f["type"] == "boolean":
        return (int, Field(default=int(f["default"]) if not isinstance(f["default"], str) else 0))
    return (str, Field(default=f["default"]))


PatientInput: type[BaseModel] = create_model(
    "PatientInput", **{f["name"]: _field_type(f) for f in SCHEMA["fields"]}
)

app = FastAPI(title="Hridya Darpan - Cardiovascular Risk API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def shap_for_target(target_id: str, df_row) -> list[dict]:
    bundle = PIPELINES[target_id]
    pre = bundle["preprocessor"]
    from preprocess import encode_features

    X = pre.transform(df_row)
    feature_names = pre.feature_names()
    raw_encoded = encode_features(df_row, pre.feature_columns).reindex(columns=feature_names, fill_value=0.0).iloc[0]
    explainer = EXPLAINERS[target_id]
    sv = explainer.shap_values(X)
    if isinstance(sv, list):
        sv = sv[1]
    sv = np.asarray(sv)
    if sv.ndim == 3:
        sv = sv[:, :, -1]
    sv = sv[0]
    order = np.argsort(-np.abs(sv))
    return [
        {"feature": feature_names[i], "shapValue": float(sv[i]), "featureValue": float(raw_encoded.iloc[i])}
        for i in order[:8]
    ]


@app.get("/schema")
def get_schema():
    return SCHEMA


@app.get("/metrics")
def get_metrics():
    return METRICS


@app.get("/global-importance")
def get_global_importance():
    return GLOBAL_IMPORTANCE


@app.post("/predict")
def predict(patient: PatientInput):
    import pandas as pd

    row = patient.model_dump()
    df_row = pd.DataFrame([row])

    result = {"featureValues": row, "targets": {}}
    for t in CONFIG["targets"]:
        tid = t["id"]
        bundle = PIPELINES[tid]
        X = bundle["preprocessor"].transform(df_row)
        prob = float(bundle["model"].predict_proba(X)[0, 1])
        result["targets"][tid] = {
            "probability": prob,
            "shap": shap_for_target(tid, df_row),
        }
    return result


@app.get("/")
def root():
    return {"status": "ok", "service": "hridya-darpan-api"}
