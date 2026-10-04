# Changelog

All notable changes to this project. Evidence tag: SYNTHETIC (everything here runs on generated data).

## 0.1.0 — unreleased

### Added
- `spark-oes512-demo.html` (main file) and `index.html` (byte-identical copy for GitHub Pages): self-contained, dark-theme page with no external resources. 512-channel heatmap (16 blocks × 32 channels), per-block score bars, alert threshold slider (default 0.50) with a "Reset to 0.50" button, five seeded deterministic synthetic scenarios (Normal, Local anomaly, Drift, Global disturbance, Missing data), explainability panel, human-review warning state, JSON export, CSV import of 512 values, rule-based Spark avatar explainer, persistent safety banner and in-page self-test.
- Score contract: 512 = 16 × 32, `S = 0.45·max|x| + 0.35·RMS + 0.20·mean|x|`, alert if `S ≥ threshold` (default 0.50). Missing data (NaN) triggers human review and is never scored; ±Infinity and non-numeric values are rejected the same way.
- `sample-512.csv`: synthetic 512-value frame.
- `tests/run_tests.js`: Node tests that execute the page's single `<script id="core">` block, with an independent reference formula, scenario, human-review, CSV, self-containment and `index.html` byte-identity checks.
- `tests/forbidden_terms.py`: repository-wide forbidden-terms scan.
- GitHub Actions CI (Node 20 / 22 / 24 + forbidden-terms scan), `CITATION.cff`, `.zenodo.json`, AGPL-3.0-only `LICENSE`, `COMMERCIAL-LICENSE.md`, `SECURITY.md`, `docs/` screenshots.
