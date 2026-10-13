"""Train, compare, calibrate, and explain the 4 binary classifiers
(CAD, LAD, LCX, RCA) on the Z-Alizadeh Sani extended dataset.

Usage: python backend/ml/train.py
Outputs (all under /models):
  - {target}_pipeline.joblib   fitted preprocessor + calibrated best model
  - {target}_portable.json     JS-evaluable export of the same model
  - {target}_roc.png           ROC curve on the held-out test set
  - {target}_shap_global.json  mean |SHAP| global importance
  - metrics.json               CV + held-out metrics for every target/model
  - schema.json                input form schema (written by schema.py)
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import RepeatedStratifiedKFold, cross_val_score, train_test_split
from xgboost import XGBClassifier

from export_js import export_model, _extract_sigmoid_calibration
from preprocess import ZASPreprocessor, load_config, load_raw_dataset, raw_feature_columns
from schema import build_schema

warnings.filterwarnings("ignore")

SEED = 42
MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
MODELS_DIR.mkdir(exist_ok=True)

CANDIDATES = {
    "logreg": lambda: LogisticRegression(max_iter=2000, class_weight="balanced", random_state=SEED),
    "random_forest": lambda: RandomForestClassifier(
        n_estimators=300, max_depth=5, min_samples_leaf=4, class_weight="balanced_subsample", random_state=SEED
    ),
    "xgboost": lambda: XGBClassifier(
        n_estimators=200, max_depth=3, learning_rate=0.08, subsample=0.8, colsample_bytree=0.8,
        eval_metric="logloss", random_state=SEED,
    ),
}


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def raw_score(fitted_model, X, kind: str) -> np.ndarray:
    if kind == "logreg":
        return fitted_model.decision_function(X)
    return fitted_model.predict_proba(X)[:, 1]


def train_target(target: dict, df, feature_columns: list[str]) -> dict:
    tid = target["id"]
    y = (df[target["sourceColumn"]] == target["positiveValue"]).astype(int).to_numpy()

    X_train_df, X_test_df, y_train, y_test = train_test_split(
        df, y, test_size=0.2, stratify=y, random_state=SEED
    )

    pre = ZASPreprocessor(feature_columns).fit(X_train_df)
    X_train = pre.transform(X_train_df)
    X_test = pre.transform(X_test_df)
    feature_names = pre.feature_names()

    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
    cv_scores = {}
    for name, build in CANDIDATES.items():
        scores = cross_val_score(build(), X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=1)
        cv_scores[name] = {"mean": float(scores.mean()), "std": float(scores.std())}

    best_name = max(cv_scores, key=lambda k: cv_scores[k]["mean"])
    base_model = CANDIDATES[best_name]()
    base_model.fit(X_train, y_train)

    calibrated = CalibratedClassifierCV(CANDIDATES[best_name](), method="sigmoid", cv=5)
    calibrated.fit(X_train, y_train)

    test_proba = calibrated.predict_proba(X_test)[:, 1]
    test_pred = (test_proba >= 0.5).astype(int)
    held_out_metrics = {
        "accuracy": float(accuracy_score(y_test, test_pred)),
        "precision": float(precision_score(y_test, test_pred, zero_division=0)),
        "recall": float(recall_score(y_test, test_pred, zero_division=0)),
        "f1": float(f1_score(y_test, test_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, test_proba)),
        "n_test": int(len(y_test)),
        "n_train": int(len(y_train)),
        "positive_rate": float(y.mean()),
    }

    fpr, tpr, _ = roc_curve(y_test, test_proba)
    plt.figure(figsize=(4, 4))
    plt.plot(fpr, tpr, label=f"AUC={held_out_metrics['roc_auc']:.3f}")
    plt.plot([0, 1], [0, 1], "--", color="gray")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(f"{target['label']} ROC ({best_name})")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / f"{tid}_roc.png", dpi=120)
    plt.close()

    joblib.dump({"preprocessor": pre, "model": calibrated, "model_kind": best_name}, MODELS_DIR / f"{tid}_pipeline.joblib")

    portable = export_model(base_model, feature_names, best_name)
    portable["calibration"] = _extract_sigmoid_calibration(calibrated)
    portable["targetId"] = tid
    portable["scaling"] = {"mean": pre.mean_.tolist(), "std": pre.std_.tolist()}
    (MODELS_DIR / f"{tid}_portable.json").write_text(json.dumps(portable))

    if best_name == "logreg":
        explainer = shap.LinearExplainer(base_model, X_train)
    else:
        explainer = shap.TreeExplainer(base_model)
    shap_values = explainer.shap_values(X_test)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_values = np.asarray(shap_values)
    if shap_values.ndim == 3:
        shap_values = shap_values[:, :, -1]
    mean_abs = np.abs(shap_values).mean(axis=0)
    order = np.argsort(-mean_abs)
    global_importance = [
        {"feature": feature_names[i], "meanAbsShap": float(mean_abs[i])} for i in order
    ]
    (MODELS_DIR / f"{tid}_shap_global.json").write_text(json.dumps(global_importance))

    print(f"[{tid}] best={best_name} cv_auc={cv_scores[best_name]['mean']:.3f} test_auc={held_out_metrics['roc_auc']:.3f}")

    return {
        "target": tid,
        "label": target["label"],
        "bestModel": best_name,
        "cvScores": cv_scores,
        "heldOut": held_out_metrics,
    }


def main():
    cfg = load_config()
    df = load_raw_dataset()
    feature_columns = raw_feature_columns(df, cfg["leakageColumns"])

    results = [train_target(t, df, feature_columns) for t in cfg["targets"]]
    metrics = {"seed": SEED, "nSamples": int(len(df)), "targets": results}
    (MODELS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))

    schema = build_schema()
    (MODELS_DIR / "schema.json").write_text(json.dumps(schema, indent=2))

    print("\nSaved metrics.json, schema.json, and per-target pipeline/portable/roc/shap files to", MODELS_DIR)


if __name__ == "__main__":
    main()
