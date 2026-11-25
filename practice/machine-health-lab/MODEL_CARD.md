# Practice model card

Selected model: random_forest_balanced.
Selection: highest validation macro-F1, before test evaluation.
Dataset: fully synthetic, 40 machines; fixed chronological periods with 120-minute horizon purge.
Eligible rows: train=49826, validation=10673, test=16420.
Test macro-F1: 0.6732.
Test Critical recall: 52.78%; Critical precision: 54.29%.
A recall of 52.78% means the model misses about 47.22% of critical test rows. It is not ready for operational safety alerts.

Inputs are explicitly allowlisted sensor/service measurements and machine type. No employee records, future failure timestamps, future failure modes or machine IDs are model inputs. Preprocessing is fitted on training only and saved with the model. Scores are uncalibrated; this is neither a guaranteed failure forecast nor a replacement for machine safety controls.

The test set was inspected in previous project work. Treat these results as a reproducible learning demonstration, not a new blind validation. Event-level recall, false-alert episodes, lead time, fresh machine holdouts and real factory data remain future work.

Verified: training, EDA, saved-pipeline HTTP contract checks and an actual localhost /predict request. Deployment is isolated on 127.0.0.1:8010 with no database connections and no automatic alerts. The API is intended for local learning only.
