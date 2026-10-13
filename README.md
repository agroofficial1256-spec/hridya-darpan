# Hridya Darpan — Cardiovascular Risk 3D Visualizer

An interactive decision-support prototype built for **Track A: Cardiovascular
Risk Visualization & Prediction** (Multimodal AI Hackathon 2026). It predicts
overall Coronary Artery Disease (CAD) status and per-vessel stenosis
probability (LAD, LCX, RCA) from clinical inputs, and maps the result onto a
rotatable 3D heart with live-colored arteries, SHAP-driven explanations, and
a patient input dashboard.

> ⚠️ **For decision support / educational purposes only. Not a substitute
> for formal diagnostic imaging.** This banner is also shown persistently in
> the app itself.

## Architecture

```
/data       Z-Alizadeh Sani extended dataset (303 patients, 59 columns)
/backend
  /ml       preprocessing, training/comparison/calibration, SHAP, exports
  /app      FastAPI server (full sklearn/XGBoost/SHAP) for local development
/models     fitted pipelines (.joblib), portable JSON exports, metrics, ROC plots
/frontend   React + Vite + React Three Fiber + Tailwind dashboard
/netlify/functions  TypeScript functions serving the deployed site's API
/config/vessels.json  single source of truth for vessel IDs, mesh names, encoding
/docs       report.md, demo_script.md
```

There are **two interchangeable backend runtimes that read the exact same
trained model artifacts**:

1. **FastAPI** (`backend/app/main.py`) — loads the `.joblib` pipelines
   directly and computes true SHAP values with the `shap` library. This is
   the reference implementation, meant for local exploration and for
   confirming the lightweight runtime below stays faithful to it.
2. **Netlify Functions** (`netlify/functions/*.mts`) — a dependency-free
   TypeScript re-implementation that evaluates the same random-forest/
   logistic-regression models from a small portable JSON export
   (`models/{target}_portable.json`), because a JAMstack deploy has no
   long-running Python process. Feature contributions here use a Saabas-style
   decision-path decomposition (exact for the linear model, a well-known
   SHAP approximation for tree ensembles) — see `docs/report.md` for why.

Both runtimes expose the same 4 routes and the frontend talks to whichever is
running on `/api/*` — nothing in the UI knows or cares which one answered.

**Everything that defines a vessel — its id, display label, which dataset
column is its ground truth, which 3D mesh it maps to, its legend color —
lives in `config/vessels.json`.** Both the Python training code and the
TypeScript functions/frontend import this one file, so adding a vessel,
feature, or model only means editing config + adding the matching
mesh/training logic, never touching every call site.

## Dataset & preprocessing

- **Source**: [UCI "Extension of Z-Alizadeh Sani Dataset"](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset)
  (303 patients, 59 columns: demographics, vitals, labs, ECG, echo, plus
  vessel-level LAD/LCX/RCA stenosis and the overall `Cath` CAD label).
  Saved as `data/z_alizadeh_sani_extended.csv`.
- **Leakage guard**: `LAD`, `LCX`, `RCA`, `Cath` are dropped from the input
  features for **all four** targets (see `config.leakageColumns`).
- **Encoding** (`backend/ml/preprocess.py`, driven by `config.encoding`):
  Y/N flags → 0/1, `Sex` → `Sex_Male`, `BBB` → one-hot (`BBB_LBBB`,
  `BBB_RBBB`), `VHD` → ordinal severity 0–3, everything else numeric
  passthrough. 55 raw columns become 56 encoded features.
- **Scaling**: all encoded features are standardized (mean 0, std 1) with a
  `ZASPreprocessor` fit once per target and saved alongside its model
  (`models/{target}_pipeline.joblib`), so train-time and inference-time
  encoding can never drift apart.

## Modeling

For each target (CAD, LAD, LCX, RCA):

1. An 80/20 stratified train/test split is held out.
2. Logistic Regression, Random Forest, and XGBoost are compared by
   5-fold × 3-repeat **stratified CV ROC-AUC** on the training split
   (`RepeatedStratifiedKFold`, seed 42). Class imbalance is handled via
   `class_weight="balanced"` (LogReg/RF) or by comparing against the other
   two algorithms' handling.
3. The best algorithm by mean CV AUC is refit and wrapped in
   `CalibratedClassifierCV(method="sigmoid", cv=5)` for probability
   calibration, then evaluated once on the untouched held-out test set.
4. SHAP (`LinearExplainer` for logistic regression, `TreeExplainer` for
   tree ensembles) computes both global importance
   (`models/{target}_shap_global.json`) and top per-prediction drivers.

### Results (held-out test set, 61 patients)

| Target | Best model | CV ROC-AUC | Test ROC-AUC | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| Overall CAD | Random Forest | 0.928 | 0.875 | 0.885 | 0.891 | 0.953 | 0.921 |
| LAD | Random Forest | 0.847 | 0.846 | 0.803 | 0.800 | 0.889 | 0.842 |
| LCX | Random Forest | 0.727 | 0.720 | 0.672 | 0.611 | 0.458 | 0.524 |
| RCA | Random Forest | 0.715 | 0.738 | 0.672 | 0.615 | 0.348 | 0.444 |

Full CV scores for every algorithm, ROC curve images, and global SHAP
importances are in `/models` (regenerate anytime with `scripts/train.sh`).
See `docs/report.md` for discussion and limitations (LCX/RCA are
meaningfully harder — smaller, noisier signal in this 303-row dataset).

## 3D visualization

`frontend/src/components/Scene3D.tsx` renders a low-poly procedural heart
(`IcosahedronGeometry`) plus three `TubeGeometry` meshes swept along
`CatmullRomCurve3` control points approximating the LAD/LCX/RCA paths. Each
mesh's color is interpolated green → yellow → red from its live predicted
probability (`config.riskColorScale`); hovering/clicking a vessel highlights
it and opens its SHAP panel. `OrbitControls` gives rotate/zoom with no
post-processing, so it runs smoothly without a dedicated GPU. Dropping a
real anatomical `.glb` into `frontend/public/models/` and flipping
`HAS_CUSTOM_MODEL` in `Scene3D.tsx` swaps in an authored mesh without
touching the prediction/coloring logic.

## Running it

### 0. One-time setup

```bash
pip install -r backend/requirements.txt
npm --prefix frontend install
```

### 1. Train (regenerates everything in /models)

```bash
./scripts/train.sh
```

### 2. Run the full stack (frontend + API), recommended

```bash
netlify dev --port 8889
# then open http://localhost:8889
```

(or `./scripts/dev.sh`, which runs the same command)

### 2'. Alternative: full-featured Python backend + separate frontend

```bash
./scripts/backend.sh     # FastAPI on :8000
# in another terminal, point the frontend proxy at :8000 then:
./scripts/frontend.sh     # Vite on :5173
```

### Verifying it works

```bash
curl -s http://localhost:8889/api/schema | python3 -m json.tool | head
curl -s -X POST http://localhost:8889/api/predict -H 'Content-Type: application/json' -d '{"Age":70,"Typical Chest Pain":1,"EF-TTE":30}'
```

Changing any clinical input and re-predicting visibly moves every vessel's
probability, its color on the heart, and its SHAP drivers.

## Deployment

The site is a static Vite build (`frontend/dist`) plus the Netlify Functions
in `netlify/functions`, both wired up in `netlify.toml`. `netlify deploy` /
pushing to the connected GitHub repo builds and serves it directly — no
separate server to run in production.

## Repo layout reference

See the tree at the top of this file. `config/vessels.json` is the one file
to edit when adding a vessel/target/model; `docs/report.md` and
`docs/demo_script.md` cover the write-up and video walkthrough outline.
