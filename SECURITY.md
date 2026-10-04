# Security Policy

Please report potential vulnerabilities privately to the repository owner rather than opening a public issue. Include a minimal reproduction, the affected commit, and the impact.

`spark-oes512-demo.html` (and its byte-identical copy `index.html`) makes no network requests and loads no external resources by design; any change that introduces one is in scope. Missing (NaN), non-finite or non-numeric values must flag the block for human review and must never be scored; a case where such input is silently scored is in scope. CSV import is parsed locally in the browser and never uploaded.

This is a research prototype that uses synthetic data only. It is not a medical device; do not use it with real patient data.
