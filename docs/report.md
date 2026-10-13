# Hridya Darpan — Technical Report

Track A: Cardiovascular Risk Visualization & Prediction — Multimodal AI Hackathon 2026

## 1. Dataset & preprocessing

**Source.** UCI "Extension of Z-Alizadeh Sani Dataset" (303 patients, 59
columns), downloaded programmatically from
`archive.ics.uci.edu/dataset/411` and saved to
`data/z_alizadeh_sani_extended.csv`. The extension adds per-vessel LAD/LCX/
RCA stenosis labels (`Normal`/`Stenotic`) alongside the original overall CAD
label (`Cath`: `CAD`/`Normal`). No missing values.

**Targets.** Four independent binary classification problems, each
driven by `config/vessels.json`:

| id | positive label | prevalence |
|---|---|---|
| `cad` | `Cath == "CAD"` | 71.3% |
| `lad` | `LAD == "Stenotic"` | 58.4% |
| `lcx` | `LCX == "Stenotic"` | 39.3% |
| `rca` | `RCA == "Stenotic"` | 37.6% |

**Leakage control.** `LAD`, `LCX`, `RCA`, and `Cath` are removed from the
input feature set for *every* target, including when predicting CAD itself
— a model that could see `LAD`/`LCX`/`RCA` would trivially solve `cad`
without learning anything clinically useful, and a model predicting `lad`
cannot see `lcx`/`rca`/`cath` either, since those still correlate with
disease severity in ways that would leak vessel-specific signal.

**Encoding** (`backend/ml/preprocess.py`): the 55 remaining raw columns
become 56 numeric features — binary Y/N flags to 0/1, `Sex` to a single
`Sex_Male` indicator, the 3-category `BBB` finding to two one-hot columns
(`N` as baseline), and the ordered `VHD` severity (`N`/`mild`/`Moderate`/
`Severe`) to 0–3. Everything else (age, vitals, labs, ECG amplitudes, EF,
Region RWMA, etc.) is already numeric. All 56 features are then
standardized (zero mean, unit variance) with a `ZASPreprocessor` fit *per
target* on that target's own train split, and persisted with the model
(`models/{target}_pipeline.joblib`) so the exact fitted transform is reused
at inference — never refit on new data.

## 2. Model choice & validation

For each of the 4 targets, three candidate algorithms are compared:
**Logistic Regression** (`class_weight="balanced"`), **Random Forest**
(300 trees, depth 5, `class_weight="balanced_subsample"`), and **XGBoost**
(200 trees, depth 3, learning rate 0.08). An 80/20 stratified train/test
split is held out *before* any model selection; comparison uses
**`RepeatedStratifiedKFold(n_splits=5, n_repeats=3)`** ROC-AUC on the
training split only, so the held-out test set is touched exactly once, at
the end, by the final calibrated model.

The highest mean-CV-AUC algorithm per target is refit on the full training
split and wrapped in `CalibratedClassifierCV(method="sigmoid", cv=5)` to
produce well-calibrated probabilities (important here: raw tree-vote
fractions are not probabilities, and the dataset's class imbalance would
otherwise bias them).

**Why Random Forest won every target.** With only 303 rows and ~56
features, XGBoost's extra flexibility did not translate into better CV AUC
once repeated-CV variance is accounted for (differences vs. RF were within
1-2 points of AUC and within one standard deviation); Random Forest's
bagging handles this sample size with lower variance. Logistic Regression
trailed more clearly on LCX/RCA, where the decision boundary looks more
non-linear/interaction-heavy (see `models/metrics.json` for every
algorithm's CV scores per target, and `models/{target}_roc.png` for ROC
curves).

### Results (held-out test set, n=61)

| Target | Best model | CV ROC-AUC | Test ROC-AUC | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| Overall CAD | Random Forest | 0.928 ± 0.048 | 0.875 | 0.885 | 0.891 | 0.953 | 0.921 |
| LAD | Random Forest | 0.847 ± 0.051 | 0.846 | 0.803 | 0.800 | 0.889 | 0.842 |
| LCX | Random Forest | 0.727 ± 0.057 | 0.720 | 0.672 | 0.611 | 0.458 | 0.524 |
| RCA | Random Forest | 0.715 ± 0.057 | 0.738 | 0.672 | 0.615 | 0.348 | 0.444 |

Overall CAD and LAD are predicted reliably (AUC > 0.84). LCX and RCA are
visibly harder — both have a minority positive class (<40%), and the
dataset's clinical features (demographics/labs/ECG) are more directly tied
to global ischemic burden and anterior-wall findings than to localizing
disease to the circumflex or right coronary distribution specifically. This
is a known limitation of this dataset for vessel-level localization, not a
pipeline bug — see Limitations.

## 3. Interpretability

SHAP is computed with `shap.TreeExplainer` (Random Forest/XGBoost targets)
or `shap.LinearExplainer` (if Logistic Regression wins a target), on the
held-out test set for global importance (`models/{target}_shap_global.json`,
served via `GET /global-importance`) and per-request for the top 8
drivers of each individual prediction (`POST /predict`).

Across all four targets, `Typical Chest Pain`, `Atypical` (chest pain),
`Age`, `EF-TTE`, and `Region RWMA` consistently rank among the top global
drivers — consistent with clinical intuition (classic anginal symptoms,
age, and echocardiographic evidence of regional dysfunction are established
CAD risk correlates).

## 4. 3D visualization pipeline

The frontend (`frontend/src/components/Scene3D.tsx`) renders a low-poly
procedural heart — a scaled `IcosahedronGeometry` with flat shading — plus
three `TubeGeometry` meshes swept along hand-placed `CatmullRomCurve3`
control points approximating the LAD (anterior/descending), LCX
(left/posterior), and RCA (right/inferior) paths over the heart surface.
Each mesh's color is a continuous green→yellow→red interpolation
(`config.riskColorScale`) of its live predicted probability; hover/click
raises the mesh's radius and emissive intensity and opens its explanation
panel. `OrbitControls` provides rotate/zoom with no post-processing stack,
keeping this smooth without a dedicated GPU. The vessel→mesh mapping, the
color thresholds, and every target's display label all come from the one
`config/vessels.json` file that both the Python training code and the
TypeScript frontend/functions import, so adding a structure means editing
config + adding its curve/model, not touching every call site. A real
`.glb` mesh can be dropped into `frontend/public/models/` and
`HAS_CUSTOM_MODEL` flipped to swap in authored anatomy without touching any
prediction/coloring code.

## 5. System architecture — two backend runtimes, one set of artifacts

A JAMstack deploy (Netlify) has no persistent Python process, so this
project ships **two interchangeable implementations of the same 4
endpoints** reading the *same trained artifacts*:

- `backend/app/main.py` — FastAPI, loads the `.joblib` pipelines directly,
  uses real `shap` explainers. Full-fidelity reference implementation for
  local development.
- `netlify/functions/*.mts` — dependency-free TypeScript. Each trained
  model is additionally exported (`backend/ml/export_js.py`) to a portable
  JSON description (logistic-regression coefficients, or every
  random-forest/XGBoost tree as a flat node array) plus its sigmoid
  calibration parameters and feature scaling stats. The function re-derives
  the identical encode → scale → tree-walk/dot-product → calibrate pipeline
  in plain JS. Per-prediction feature contributions here use a **Saabas
  decision-path decomposition** (the child-minus-parent expected-output
  delta at each split, averaged over trees) rather than exact SHAP — for
  the linear case this is mathematically identical to SHAP; for tree
  ensembles it is a well-known, cheap approximation to TreeSHAP that needs
  no background dataset or extra dependency at inference time. Both
  runtimes were cross-checked against each other on the same inputs; their
  calibrated probabilities agree to within ~1-2 points (the residual gap is
  the TS runtime averaging each fold's Platt-scaling parameters into one
  pair, vs. sklearn averaging 5 separately-calibrated fold predictions).

## 6. Limitations

- **Sample size.** 303 patients is small for 4 independent binary models;
  CV-AUC standard deviations (~0.05) reflect genuine uncertainty, not just
  noise in the estimate.
- **LCX/RCA localization.** As discussed above, these two targets predict
  meaningfully worse than CAD/LAD with this feature set — a clinically
  honest result worth stating rather than hiding.
- **No imaging input.** Per the challenge brief, `Region RWMA` is a
  categorical echo finding, not a pixel-level or 3D lesion map — it is used
  as an ordinary tabular feature, and the 3D visualization is a
  probability-driven schematic, not a reconstruction of the patient's
  actual anatomy.
- **Approximate contributions in the deployed runtime.** As above, the
  Netlify Functions path uses Saabas path decomposition rather than exact
  TreeSHAP; it is intended to match the FastAPI/SHAP reference closely, not
  bit-for-bit.
- **Prototype, not a clinical tool.** This is explicitly a decision-support
  / educational demo (see the persistent in-app disclaimer), trained on a
  single-center retrospective dataset, with no external validation.
