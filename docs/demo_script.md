# Demo Video Outline (3–10 minutes)

**Working title:** Hridya Darpan — Cardiovascular Risk 3D Visualizer

1. **Hook & disclaimer (0:00–0:30)**
   - Show the app, point at the persistent disclaimer banner.
   - One sentence on the problem: risk percentages alone don't tell a
     clinician *where* in the heart disease is concentrated.

2. **3D visualization tour (0:30–2:00)**
   - Orbit/zoom the heart with the default (dataset-median) patient loaded.
   - Point out the 3 colored artery tubes (LAD/LCX/RCA) and the legend.
   - Click one vessel to show the highlight + side panel opening.

3. **Feature input workflow (2:00–4:00)**
   - Apply the "Low-risk baseline" preset → show all probabilities and
     artery colors shift toward green.
   - Apply "Classic high-risk angina" → show them shift toward red live.
   - Expand a couple of input groups (demographics, ECG, echo) and tweak a
     single field (e.g. `EF-TTE`) to show real-time re-prediction.

4. **Clinical interpretability (4:00–6:00)**
   - Select the overall CAD card, walk through its SHAP bar chart — point
     out top positive (red) vs. protective (teal) drivers and their values.
   - Switch to a vessel with a different driver profile (e.g. RCA) to show
     the explanation is vessel-specific, not a single global score.

5. **Technical walkthrough (6:00–8:30)**
   - Show `config/vessels.json` and explain it's the single source of truth
     for vessel naming/mesh mapping across Python and TypeScript.
   - Show `models/metrics.json` / the ROC plots; mention the CV methodology
     (repeated stratified k-fold, held-out test set, calibration).
   - Briefly show the two backend runtimes (`backend/app/main.py` FastAPI
     vs. `netlify/functions/predict.mts`) and explain why a serverless
     deploy needed the portable-JSON re-implementation.

6. **Wrap-up (8:30–9:30)**
   - Restate the disclaimer and the dataset's known limitations (LCX/RCA
     are harder to localize with this feature set).
   - One sentence on what you'd add with more time (e.g. a real anatomical
     `.glb`, LIME cross-check, external validation cohort).

**Recording tips:** run `./scripts/dev.sh` and record the browser at
`http://localhost:8889`; narrate live interactions rather than reading
slides so the "real-time" claim is visibly demonstrated.
