"""Exports a fitted sklearn estimator + its sigmoid calibration into a small
JSON structure that the Netlify Function (Node/TS) runtime can evaluate
without any Python/ML dependencies. Supported estimator kinds: logistic
regression, random forest, and XGBoost (sklearn API) binary classifiers.
"""
from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier


def _extract_sigmoid_calibration(calibrated_clf) -> dict:
    """Average the per-fold Platt-scaling (A, B) params of a fitted
    CalibratedClassifierCV(method="sigmoid") into one portable pair, so
    calibrated_prob = sigmoid(A * raw_score + B)."""
    a_vals, b_vals = [], []
    for cc in calibrated_clf.calibrated_classifiers_:
        for calibrator in cc.calibrators:
            a_vals.append(float(calibrator.a_))
            b_vals.append(float(calibrator.b_))
    return {"a": float(np.mean(a_vals)), "b": float(np.mean(b_vals))}


def export_logreg(model: LogisticRegression, feature_names: list[str]) -> dict:
    coef = model.coef_[0].tolist()
    intercept = float(model.intercept_[0])
    return {
        "kind": "logreg",
        "featureNames": feature_names,
        "coef": coef,
        "intercept": intercept,
    }


def _export_sklearn_tree(tree, feature_names: list[str]) -> dict:
    t = tree.tree_
    nodes = []
    for i in range(t.node_count):
        if t.children_left[i] == -1:
            value = t.value[i][0]
            total = value.sum()
            leaf_prob = float(value[1] / total) if total > 0 else 0.0
            nodes.append({"leaf": True, "value": leaf_prob})
        else:
            nodes.append({
                "leaf": False,
                "feature": feature_names[t.feature[i]],
                "threshold": float(t.threshold[i]),
                "left": int(t.children_left[i]),
                "right": int(t.children_right[i]),
            })
    return {"nodes": nodes}


def export_random_forest(model: RandomForestClassifier, feature_names: list[str]) -> dict:
    trees = [_export_sklearn_tree(est, feature_names) for est in model.estimators_]
    return {"kind": "rf", "featureNames": feature_names, "trees": trees}


def export_xgboost(model, feature_names: list[str]) -> dict:
    booster = model.get_booster()
    booster.feature_names = feature_names
    dumps = booster.get_dump(dump_format="json", with_stats=False)
    import json as _json

    def convert(node) -> dict:
        if "leaf" in node:
            return {"leaf": True, "value": float(node["leaf"])}
        return {
            "leaf": False,
            "feature": node["split"],
            "threshold": float(node["split_condition"]),
            "left": node["yes"],
            "right": node["no"],
            "missing": node.get("missing", node["yes"]),
        }

    trees = []
    for dump in dumps:
        raw = _json.loads(dump)
        flat: dict[int, dict] = {}

        def walk(node):
            flat[node["nodeid"]] = convert(node)
            for child in node.get("children", []):
                walk(child)

        walk(raw)
        # renumber nodeids to a dense 0..n-1 array matching the RF export shape
        id_map = {old: new for new, old in enumerate(sorted(flat.keys()))}
        nodes = []
        for old_id in sorted(flat.keys()):
            n = flat[old_id]
            if not n["leaf"]:
                n = {**n, "left": id_map[n["left"]], "right": id_map[n["right"]]}
            nodes.append(n)
        trees.append({"nodes": nodes})
    return {"kind": "xgb", "featureNames": feature_names, "trees": trees, "base_score": 0.5}


def export_model(model, feature_names: list[str], model_kind: str) -> dict:
    if model_kind == "logreg":
        return export_logreg(model, feature_names)
    if model_kind == "random_forest":
        return export_random_forest(model, feature_names)
    if model_kind == "xgboost":
        return export_xgboost(model, feature_names)
    raise ValueError(f"unknown model kind {model_kind}")
