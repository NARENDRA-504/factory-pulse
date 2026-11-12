# First training and local deployment

Verified on 10 November 2026.

- Downloaded 12,330 real UCI session records.
- Removed 125 exact duplicate rows.
- Grouped selected-feature duplicates to prevent overlap across partitions.
- Training: 8,548 rows; validation: 1,855; test: 1,802.
- Validation average precision: Logistic Regression 0.3103; Random Forest 0.3760.
- Selected Random Forest and a validation-selected threshold of 0.56.

Held-out test:

| Metric | Result |
|---|---:|
| Precision | 34.78% |
| Recall | 42.11% |
| F1 | 0.3810 |
| Average precision | 0.3340 |
| ROC-AUC | 0.7588 |
| Accuracy | 79.80% |
| Constant no-purchase baseline accuracy | 85.24% |

The baseline has higher accuracy by predicting no purchases, but finds none of the purchasing sessions. This model detects some purchases at the cost of false positives. The results illustrate why accuracy alone is insufficient. Performance remains modest and does not justify production marketing decisions.

Seven API checks passed. A real HTTP request returned the same usable prediction schema. GET /health returned ok, GET /docs returned HTTP 200, and POST /predict returned a score of 0.0230453 for example_request.json with predicted_purchase=false.

The API is started locally at http://127.0.0.1:8090/docs . It must remain running for the page to work. Public hosting and Docker build have not been performed. The automated API checks emitted a Starlette/httpx deprecation warning; there were no failed tests.

See artifacts/metrics.json for full metrics, confusion matrix, source hash, package versions and limitations. Do not use this test set to tune the next iteration.
