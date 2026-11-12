# FactoryPulse machine-health data science challenge

## Business problem
A fictional manufacturer operates 40 machines across four plants. Build a model that uses information available at the observation time to prioritize machines for investigation before a failure. The goal is to reduce unplanned downtime by finding warning signs while limiting unnecessary alerts. Cost estimation is outside this exercise.

This is deliberately imperfect, fully synthetic learning data, generated with seed 20261111. It is not collected from physical equipment and must not be used to set real machine safety limits. Its size and structure make it useful for practicing a complete workflow, but synthetic performance does not prove real-world reliability.

## What you receive
- 81,375 raw packets, including duplicates; 80,640 unique observation IDs.
- 40 machines, four families: Milling, Turning, Grinding and Drilling.
- 14 days, January 1–14, 2026, sampled every 10 minutes per machine.
- 120 fictional failure events with repair completion times.
- Temperature, vibration, RPM, current, load, pressure, coolant flow, ambient temperature and service-age features.
- Machine registry, ID crosswalk, maintenance records, separate labels and a chronological split plan.

## Target definition
The target is **future failure proximity**, not a diagnosis of the machine's present physical condition:

| Label | Meaning |
|---|---|
| Normal | No simulated failure in the next 120 minutes, with sufficient follow-up |
| Suspect | Next failure is more than 30 and at most 120 minutes away |
| Critical | Next failure is more than 0 and at most 30 minutes away |
| Ineligible | Machine is already down; exclude from this predictive task |
| Unknown | Insufficient follow-up at the end of the dataset; exclude |

Before cleaning: Normal 77,858; Suspect 1,080; Critical 360; Ineligible 902; Unknown 440. The rare positive classes are intentional. Some failures have no useful early precursor, so a perfect score is not a realistic requirement.

## Files
| File | Purpose |
|---|---|
| telemetry_raw.csv | Dirty, shuffled sensor packets to clean |
| machine_registry.csv | Canonical machine identities and fictional specifications |
| machine_id_crosswalk.csv | Alias-to-canonical identity mapping |
| training_labels.csv | Observation targets and future outcome information |
| failure_events.csv | Failure and return-to-service events for outcome analysis |
| maintenance_log.csv | Maintenance actions; only usable after their availability timestamp |
| split_plan.json | Training, validation, test boundaries and purge rules |
| DATA_QUALITY_INSTRUCTOR_NOTES.json | Spoilers: injected defects and counts; inspect after your first audit |
| checksums.json | SHA-256 checksums for the CSV files |

## Your assignments
1. Audit row counts, types, missingness, units, duplicates, machine identities and timestamp coverage. Write down findings before changing data.
2. Normalize units and timestamps, reconcile IDs and handle invalid values. Investigate stuck sensors and conflicting duplicates. Document a deterministic resolution policy; do not arbitrarily keep the first shuffled row.
3. Preserve an untouched raw copy. Produce a cleaned table and a report of exclusions, corrections and remaining uncertainty. Quality flags describe packet quality, not health labels.
4. Join labels by packet_id after deduplication. Keep Unknown/Ineligible observations out of supervised training. Check class balance by machine, family and time period.
5. Create past-only rolling means, variability, slopes, lags and missingness indicators per machine. Never let a rolling window cross machine boundaries.
6. Use split_plan.json: first nine days for training, next two for validation and final three for testing. Purge the last 120 minutes of each partition so its full outcome horizon stays inside that partition. Do not randomly split shuffled rows.
7. Fit imputers, scalers, encoders and any feature selection using training data only. Compare a majority baseline, logistic regression and a tree-based model. Tune thresholds on validation only.
8. Report per-class precision/recall/F1, macro-F1, confusion matrices, and precision-recall metrics for Suspect/Critical. Also measure false-alert episodes per machine-day and detection lead time. Accuracy alone hides missed failures. Define how consecutive alert rows become one episode.
9. Inspect missed failures, false alerts, sensor defects and performance by machine family. Evaluate the test-period distribution shift. Keep the final test untouched until model choices are frozen.
10. Prepare a reproducible notebook, cleaning module, saved preprocessing/model pipeline, model card and sample API request/response. Do not connect a practice model to operational alerts without separate validation.

## Leakage traps
- Never use health_priority, next_failure_at_utc or next_failure_mode as input features.
- Future failure events and repair outcomes exist for constructing/evaluating labels, not prediction inputs.
- A maintenance record becomes available only at available_at_utc. Join historical records as of the observation time; do not join future repairs.
- Do not impute using future observations or fit preprocessing on the whole dataset.
- Duplicate packets must not appear across dataset partitions.
- Machine IDs can encourage memorization. Report results by machine and optionally perform a separate held-out-machine evaluation.

## Suggested deliverables
01_data_audit.ipynb; 02_cleaning_and_features.ipynb; 03_training_and_evaluation.ipynb; cleaning.py; model_pipeline file; model_card.md; requirements.txt; evaluation report.

The practice package does not modify FactoryPulse, AI Simulator, MySQL, accounts or live telemetry. No model is trained by this package.


## Guided beginner workflow
Read Machine health practical guide.docx (14 pages), then open START_HERE.ipynb. Install requirements.txt in a separate environment. A browser-readable HTML copy of the guide is also included. The notebook has no saved model results; its audit, cleaning and split cells were checked. Optional model training remains yours to run.
