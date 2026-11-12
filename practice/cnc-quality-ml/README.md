# ML practice: predict CNC part inspection failure

## Dummy business problem

PrecisionWorks is a fictional machine shop. It wants to prioritize completed parts for extra quality inspection before shipment. Build a classifier that estimates the probability a part will fail final inspection from its process readings. A high-risk prediction recommends human inspection; it does not authorize skipping mandatory quality checks or automatically scrapping a part.

## Dataset

Entirely synthetic, generated locally for practice with seed 20261109. There are 6,000 part records, 20 fictional machines, 8 numeric inputs, 1 categorical input, 3 metadata columns and 1 binary target. See DATA_DICTIONARY.md and dataset_summary.json. This dataset is separate from FactoryPulse and does not read or modify either application, MySQL or SQLite.

Files: cnc_quality_dataset.csv (all rows), train.csv (4,200 rows), validation.csv (900 rows), test.csv (900 rows), example_request.json (one inference request), dataset_summary.json and DATA_DICTIONARY.md. Train/validation/test are consecutive chronological partitions with no overlapping part IDs. Use either the supplied splits or the full file, never combine both for training.

## Training practice

1. Load train.csv. Count target classes, inspect missing values and plot feature distributions. Calculate a majority-class baseline.
2. Use material plus the eight numeric columns as features. Exclude part_id, machine_id and recorded_at_utc. Target is inspection_failed.
3. Fit numeric median imputation, categorical encoding and any scaling on TRAIN ONLY. Keep preprocessing and estimator in one saved pipeline.
4. Start with logistic regression, then compare a tree-based classifier. Use validation.csv for settings and decision-threshold selection.
5. Report precision, recall, F1, confusion matrix, PR-AUC and ROC-AUC. Compare with the baseline; accuracy alone can hide missed defects. Report probability calibration if using predicted risk as a probability.
6. Select an inspection threshold using validation data, freeze it, then evaluate test.csv once. Do not tune against test results.
7. Save the whole preprocessing/model pipeline, selected threshold, feature schema, dependency versions and metrics. No model has been trained in this starter package.

## Business insight exercise

Assume an EXTRA inspection costs 20 INR and an undetected defective part costs 500 INR. These are editable fictional costs, not market rates. Validation cost = 20 * flagged_parts + 500 * missed_defective_parts. Compare the model policy with inspect-none and inspect-all using the same assumptions. This simplified exercise assumes extra inspection detects all defective parts and ignores other operational costs. The lowest-cost threshold may differ from 0.5; calculate it rather than guessing.

## Deployment practice

Create a separate prediction service with POST /predict. Accept the fields in example_request.json, validate names/types and plausible input ranges, apply the saved preprocessing pipeline, and return risk_score (0 to 1), inspection_recommended (boolean), threshold and model_version. Preserve training feature order and category handling. Exclude the target and metadata from requests. Allow missing numeric readings only if your training pipeline supports them.

Load the model once at service startup. Add GET /health. Check a normal request, a missing required field, invalid numeric input and an unknown material. Verify the API prediction matches the saved pipeline on the same input. Start locally, then package the service with pinned dependencies and a container if desired. Hosted deployment is a later step; no service is deployed by this dataset package.

## Limits

This exercise teaches tabular classification and deployment mechanics. Good test scores on generated data do not establish real manufacturing performance. The timestamp split does not test genuine drift, and machine-held-out evaluation would be a separate advanced exercise. Collect labeled real data and validate with manufacturing specialists before any operational use.
