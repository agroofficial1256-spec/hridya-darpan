"""Builds the input-form schema (types, ranges, defaults) straight from the
raw dataset so the frontend form and the backend's /schema endpoint always
describe the same fields the model actually consumes.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from preprocess import ROOT, YN_MAP, BBB_CATEGORIES, VHD_MAP, load_config, load_raw_dataset, raw_feature_columns

UNITS = {
    "Age": "years", "Weight": "kg", "Length": "cm", "BMI": "kg/m²", "BP": "mmHg",
    "PR": "bpm", "FBS": "mg/dL", "CR": "mg/dL", "TG": "mg/dL", "LDL": "mg/dL",
    "HDL": "mg/dL", "BUN": "mg/dL", "ESR": "mm/hr", "HB": "g/dL", "K": "mEq/L",
    "Na": "mEq/L", "WBC": "cells/µL", "Lymph": "%", "Neut": "%", "PLT": "x10³/µL",
    "EF-TTE": "%",
}


def build_schema() -> dict:
    cfg = load_config()
    df = load_raw_dataset()
    feature_cols = raw_feature_columns(df, cfg["leakageColumns"])
    group_lookup: dict[str, str] = {}
    for group, cols in cfg["featureGroups"].items():
        for c in cols:
            group_lookup[c] = group

    fields = []
    for col in feature_cols:
        series = df[col]
        group = group_lookup.get(col, "other")
        if col == "Sex":
            field = {"name": col, "type": "categorical", "options": ["Male", "Fmale"], "default": "Male"}
        elif col == "BBB":
            field = {"name": col, "type": "categorical", "options": ["N", *BBB_CATEGORIES], "default": "N"}
        elif col == "VHD":
            field = {"name": col, "type": "categorical", "options": list(VHD_MAP.keys()), "default": "N"}
        elif set(series.unique().tolist()) <= set(YN_MAP.keys()):
            field = {"name": col, "type": "boolean", "default": "N"}
        elif sorted(series.unique().tolist()) == [0, 1]:
            field = {"name": col, "type": "boolean", "default": int(series.mode()[0])}
        else:
            field = {
                "name": col,
                "type": "number",
                "min": float(series.min()),
                "max": float(series.max()),
                "default": float(series.median()),
                "unit": UNITS.get(col, ""),
            }
        field["group"] = group
        field["label"] = col
        fields.append(field)
    return {"fields": fields}


if __name__ == "__main__":
    schema = build_schema()
    out_path = ROOT / "models" / "schema.json"
    out_path.write_text(json.dumps(schema, indent=2))
    print(f"wrote {out_path} with {len(schema['fields'])} fields")
