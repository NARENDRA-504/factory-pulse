# Separate predictive-maintenance practice

Source: https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset

AI4I 2020, UCI Machine Learning Repository, DOI 10.24432/C5HS5C. CC BY 4.0. This is a 10,000-row **synthetic** benchmark, not independently labeled factory evidence.

Run from the FactoryPulse folder using the existing practice environment:

```powershell
& ".\practice\machine-health-lab\.venv\Scripts\python.exe" scripts/train_ai4i_practice.py --download
```

The small source CSV, trained practice artifact and evaluation are saved only in ignored `.local/ai4i-practice`. Subsequent runs do not download again. Neither operational model nor SQL records are replaced. Never load joblib artifacts from an untrusted source.

The script validates row count, IDs, missing values, labels and finite values. It uses material type, air/process temperatures in Kelvin, RPM, torque and tool wear. Product IDs and failure-mode flags are excluded to prevent target leakage. Kelvin temperatures are not silently relabeled Celsius or mapped to coolant/motor readings.

Training uses the first 6,000 rows, validation the next 1,900 after a 100-row gap, and test the last 1,900 after another gap. Row order is not a verified clock or independent-machine split. Validation chooses the classification threshold; test results are reported without choosing a new threshold. Record missed failures and false alarms from the confusion matrix, precision, recall, F1 and average precision; majority accuracy alone hides rare failures.

The target describes a failure **on the current row**. It does not establish a future warning horizon or justify three severity classes. No pressure/vibration/current/flow readings are invented to fit FactoryPulse's seven-channel model. This benchmark is deliberately separate from runtime predictions.

For deployment approval, obtain representative independently labeled equipment records, hold out equipment and failure events, verify timestamps and warning horizon, assess false alarms and missed failures with site engineers, then complete a controlled shadow evaluation. Existing model alerts stay disabled.

For SOP approval use `knowledge/sop/site-approval-template.json` and `scripts/check_site_sop.py`. A qualified site owner must supply the applicable manual, machine mapping, approved procedure and review details. Software validation is not safety approval.

## Executed benchmark — 23 November 2026

Random Forest, 160 trees, balanced classes, fixed seed 42. Validation selected threshold 0.40. The untouched 1,900-row test contained 38 failures: 27 detected, 11 missed, and 33 false alarms. Recall 71.1%, precision 45.0%, F1 55.1%, average precision 68.8%. Always predicting no failure would score 98% accuracy while detecting zero failures. These results do not justify operational activation. Full split results and source/artifact checksums are recorded in `.local/ai4i-practice/evaluation.json`.
