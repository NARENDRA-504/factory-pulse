# ShopSense: your first real-data ML model

## Business problem

An online shop wants to understand which browsing sessions are associated with a purchase. Train a binary classifier: Revenue=True means a purchase, Revenue=False means no purchase. The model can support an analyst reviewing sessions. It does not prove that sending a discount or intervention will increase sales.

This is a standalone learning project. No FactoryPulse API, machine data, MySQL, credentials or Simulator files are used.

## What each stage means

1. **Data:** historical examples pair browsing features with the actual purchase outcome.
2. **Features (X):** page counts, time spent on pages, month, visitor type and weekend.
3. **Target (y):** Revenue. The model must never receive this as a prediction input.
4. **Training:** learn relationships from the training partition.
5. **Validation:** choose between Logistic Regression and Random Forest, then choose a classification threshold.
6. **Testing:** evaluate the chosen model once against held-out examples.
7. **Saving:** store preprocessing, model and threshold together.
8. **Deployment:** load the artifact into a FastAPI service and accept new requests.

## Real dataset and scope

Source: UCI Online Shoppers Purchasing Intention Dataset, donated 2018, 12,330 sessions. Dataset DOI: https://doi.org/10.24432/C5F88Q . Attribution: Sakar, C. and Kastro, Y., Online Shoppers Purchasing Intention Dataset, UCI Machine Learning Repository. License: CC BY 4.0; confirm the source page for current metadata.

https://archive.ics.uci.edu/dataset/468/online+shoppers+purchasing+intention+dataset

The download is cached locally under data/. Full-row duplicates are removed. Identical selected-feature vectors are grouped together before splitting approximately 70%/15%/15%, so they cannot leak across partitions. Actual row counts appear in artifacts/metrics.json. This is a fixed random grouped split, not a temporal test. It does not measure future drift.

Selected features:

| Input | Meaning |
|---|---|
| Administrative | Number of account/admin pages visited |
| Administrative_Duration | Seconds on those pages |
| Informational | Number of information pages visited |
| Informational_Duration | Seconds on those pages |
| ProductRelated | Number of product pages visited |
| ProductRelated_Duration | Seconds on product pages |
| Month | Dataset month code, such as Nov or June |
| VisitorType | Returning_Visitor, New_Visitor or Other |
| Weekend | true or false |

PageValues, BounceRates and ExitRates are excluded to reduce outcome/timing leakage risk. Other session totals also require event-level timing validation before a genuine real-time deployment. The public data does not provide event sequences for that verification.

## Open the project in VS Code

Choose File -> Open Folder and select:

    C:\Users\NARENDRA\OneDrive\Documents\ChatGPT\factory pulse 2\practice\shopsense

Choose Terminal -> New Terminal. In VS Code, select .venv\Scripts\python.exe as the Python interpreter. You do not have to activate the virtual environment; the commands below use it directly.

## Train the model yourself

Run from the shopsense folder:

```powershell
.\.venv\Scripts\python.exe train.py
```

Training downloads/caches the UCI CSV, validates its schema, creates the splits, fits preprocessing only on training data, trains two models and compares validation average precision. It selects the validation F1 threshold and then evaluates the test set. It writes:

- data/train.csv, validation.csv, test.csv
- artifacts/model.joblib (complete fitted pipeline)
- artifacts/metrics.json (scores, confusion matrix, versions, source hash and limitations)
- example_request.json (real held-out example without its target)

Retraining overwrites these practice outputs. Inspect train.py as you learn; do not repeatedly tune against the test result. Use validation or cross-validation for further experiments, and keep a fresh final holdout for serious comparisons.

## Understand your results

- **Precision:** of sessions predicted to purchase, how many purchased?
- **Recall:** of sessions that purchased, how many did the model find?
- **F1:** balances precision and recall at the chosen threshold.
- **Average precision:** evaluates ranking across precision/recall thresholds. The constant-score baseline is included.
- **ROC-AUC:** another ranking measure; use alongside class-aware metrics.
- **Brier score:** mean squared error of the scores against outcomes, lower is better. Scores are not guaranteed calibrated.
- **Confusion matrix:** rows are actual [no purchase, purchase]; columns are predicted [no purchase, purchase].

High accuracy alone can be misleading because most sessions did not purchase. The threshold maximizes validation F1, not business profit. This package does not invent sales gains or costs.

## Deploy locally

In the VS Code terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8090
```

Leave that terminal running. Open http://127.0.0.1:8090/docs . This is your interactive prediction app:

1. Expand GET /example -> Try it out -> Execute. Copy its response JSON.
2. Expand POST /predict -> Try it out. Replace the sample body with the copied JSON.
3. Click Execute. Read purchase_score, predicted_purchase, threshold and model_version.
4. GET /metrics shows the saved evaluation. GET /health checks the loaded service.

To call it from a second PowerShell terminal:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/predict' -Method Post -ContentType 'application/json' -Body (Get-Content -Raw .\example_request.json)
```

Try different valid counts/durations and compare scores. If a page count is zero, its duration must be zero. Unknown fields, target fields, negative values and unknown categories are rejected. Input limits are application validation bounds, not learned business rules.

Stop only this service with Ctrl+C in its terminal. Localhost works on your PC while it is running; it is not a public hosted website.

## Check the deployment

```powershell
.\.venv\Scripts\python.exe -m unittest test_app
```

Tests check API/pipeline agreement, target leakage rejection, missing/invalid input, inconsistent duration and health. Loading joblib requires trusted local artifacts: do not replace model.joblib with an untrusted download. Use the pinned requirements from this training environment when serving the artifact.

## Optional public deployment later

A Dockerfile is included. Once Docker is installed:

```powershell
docker build -t shopsense .
docker run --rm -p 8090:8090 shopsense
```

The image serves the already trained artifact. Container build and public hosting have not been verified by inclusion of this file. A public deployment needs your chosen hosting account, access controls/rate limits, HTTPS, and service monitoring. No paid resources or public endpoint are created here.

## Recreate the environment on another PC

Use Python 3.12, then:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe train.py
```

Learning references:

- https://scikit-learn.org/stable/common_pitfalls.html
- https://scikit-learn.org/stable/model_persistence.html
- https://fastapi.tiangolo.com/tutorial/first-steps/
