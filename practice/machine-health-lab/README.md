# Machine-health ML practice: train → validate → deploy

This is a separate learning project. It never connects to FactoryPulse, the AI Simulator or MySQL, and never creates operational alerts.

## The business question

Can sensor readings help prioritize machines that may fail soon? Predict **Normal**, **Suspect**, or **Critical**. These labels represent proximity to a fictional future failure, not a diagnosis of a real machine:

* Normal: no modeled failure in the next 120 minutes, with sufficient follow-up.
* Suspect: failure more than 30 and at most 120 minutes away.
* Critical: failure more than zero and at most 30 minutes away.

The dataset is **fully synthetic**, not downloaded factory measurements: 40 fictional machines, four plants, 14 days, 81,375 raw packets including duplicates. It deliberately contains missing values, mixed units, decimal commas, invalid readings, aliases and class imbalance. The prepared split CSVs are a guided starting point from an earlier cleaning exercise; they are not untouched raw data. See `data/cleaning_report.json` and `data/DATA_DICTIONARY.md`.

## Run in VS Code on Windows

Extract the ZIP into a new folder. In VS Code choose **File → Open Folder**, open that extracted folder, then **Terminal → New Terminal**. The terminal must be inside the folder containing `train.py` and `serve.py`.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe eda.py
.\.venv\Scripts\python.exe train.py
.\.venv\Scripts\python.exe check_deployment.py
.\.venv\Scripts\python.exe -m uvicorn serve:app --host 127.0.0.1 --port 8010
```

On this PC I already created a separate environment and tested training. You can start from `eda.py` without reinstalling. Python 3.12 is recommended for reproducing this exercise. The local `requirements-lock.txt` records the exact tested versions. A ZIP does not include `.venv`; create a fresh environment on another PC. Never load an untrusted `.joblib` model; rerun training to create your own.

Open **http://127.0.0.1:8010/docs**, expand **POST /predict**, click **Try it out**, paste the contents of `artifacts/sample-request.json`, and click **Execute**. The response contains the prediction and three uncalibrated model scores. This is a separate practice deployment on your PC, not a public hosted service.

Or use a second PowerShell terminal in the same folder:

```powershell
$sample = Get-Content .\artifacts\sample-request.json -Raw
Invoke-RestMethod -Uri 'http://127.0.0.1:8010/predict' -Method Post -ContentType 'application/json' -Body $sample
```

Stop the practice server with **Ctrl+C**. It does not affect either main app.

## What to do, and why

| Step | What you do | Why |
|---|---|---|
| 1. Understand | Read the dictionary and label definitions. | Current abnormal readings and future failure prediction are different tasks. |
| 2. Audit raw data | Run `eda.py`; inspect missingness, duplicate IDs, units, timestamps and quality flags. | Bad data can produce convincing but wrong models. |
| 3. Clean deliberately | For the advanced exercise, rebuild prepared data from raw: map machine aliases, resolve conflicting duplicate packets, parse UTC times, replace sentinels before C/F and kPa/bar conversion. | Unit mistakes and arbitrary deduplication damage the signal. Record every exclusion; preserve raw files. |
| 4. Select features | This starter uses nine sensor/service measurements and machine type. | Machine ID memorization and future-outcome columns are excluded. |
| 5. Split by time | Train January 1–9, validate January 10–11, test January 12–14. The final 120 minutes of each period are excluded. | A label looks 120 minutes ahead; the purge keeps that future outcome within its partition. Random row splitting would give an unrealistic result. |
| 6. Fit preprocessing | Median imputation, missingness flags, scaling and category encoding are fitted only on training rows inside a Pipeline. | Fitting on validation/test data leaks information. |
| 7. Compare | Train a majority baseline, balanced logistic regression and a balanced random forest. | A complicated model is not automatically better; rare critical cases make accuracy misleading. |
| 8. Validate | Choose the model with highest validation macro-F1. | Validation guides model choice; it is not final proof. |
| 9. Test | Freeze the choice, evaluate the final time period, inspect per-class recall/precision/F1 and the confusion matrix. | Critical recall measures missed critical rows; precision measures how often critical predictions are right. |
| 10. Inspect errors | Investigate Critical→Normal and Normal→Critical cells, then compare by machine family. | Missing a failure and generating nuisance alerts have different consequences. |
| 11. Save and serve | Save preprocessing and model together; validate requests through `/predict`. | Training and deployment must use the same units, feature names and transformations. |
| 12. Improve responsibly | Add past-only rolling vibration/temperature features, compare on validation, evaluate failure episodes/lead time, and eventually obtain a fresh future test period. | Better row scores alone do not prove useful warnings. |

## EDA questions to answer yourself

1. Which column has the most missing values? Are missing values concentrated in a machine type?
2. How many rows repeat a packet ID? Do repeated packets disagree?
3. What percentage of training rows are Critical? What would an always-Normal model achieve?
4. Are temperature units mixed? What happens if you ignore Fahrenheit?
5. Does the test period differ from training? Which failures are missed?

## Files and outputs

* `data/telemetry_raw.csv`: imperfect original packets for EDA.
* `data/training_labels.csv`: outcome labels. Never use `next_failure_at_utc`, `next_failure_mode` or `health_priority` as input features.
* `data/train.csv`, `validation.csv`, `test.csv`: previously prepared features; the training script further enforces eligibility and the purge.
* `eda.py`: raw-data audit and class-balance figure, without changing data.
* `train.py`: preprocessing, three-model comparison, model selection and evaluation.
* `serve.py`: local HTTP deployment with strict request fields, finite-value validation and artifact checksum verification.
* `artifacts/evaluation.json`: metrics, class counts, split boundaries, package versions and dataset hashes.
* `artifacts/confusion-matrix.png`: test mistakes by class. Rows are actual labels; columns are predictions.
* `artifacts/model.joblib`: your trusted saved pipeline. This file is regenerated when you train.

Optional notebook learning: install `jupyterlab` in this same environment, then run `python -m jupyterlab` and open `01_explore.ipynb`.

## Limits you must state in a demo

Synthetic learning results are not evidence that a real machine is safe or about to fail. The same dataset's test set was inspected in earlier FactoryPulse experiments, so it is no longer a genuinely unseen benchmark for this project. The exercise demonstrates the correct separation of train/validation/test in code. Real deployment additionally needs new representative labeled data, event-level recall/lead-time/false-alert evaluation, calibration, drift monitoring and an authorized rollout. This practice API does not connect to your operational alert pipeline.
