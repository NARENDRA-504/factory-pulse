"""Build a reproducible notebook; execute separately with run_phase1_notebook.py."""
import nbformat as n
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
cells=[]
def md(s):cells.append(n.v4.new_markdown_cell(s))
def code(s):cells.append(n.v4.new_code_cell(s))
md('''# FactoryPulse — executed Phase 1 data evidence

This notebook reads the original research CSV files and the actual FactoryPulse MySQL latest-reading view. It performs **no database writes**. CSV research and operational telemetry remain distinct sources. No entered statistical summaries, missing-value imputation or automatic duplicate deletion are used.

Run from the project virtual environment. Set `FACTORYPULSE_DATASET_ROOT` if the original CSV folder differs. MySQL uses the backend's existing local environment configuration; connection strings and credentials are never displayed. Saved results are snapshots, not live reports.''')
code('''from pathlib import Path
import sys, json, datetime as dt
ROOT = Path.cwd() if (Path.cwd() / "api_server").is_dir() else Path.cwd().parent
sys.path.insert(0, str(ROOT))
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from IPython.display import display
from scripts.phase1_evidence import research_sources, quality_summary, numeric_summary, mysql_snapshot, live_statistics, reconciliation
executed_at = dt.datetime.now(dt.timezone.utc).isoformat()
print("Execution UTC:", executed_at)
print("pandas", pd.__version__, "numpy", np.__version__)
plt.rcParams.update({"figure.figsize": (10,4), "axes.spines.top":False,"axes.spines.right":False})''')
md('## 1. Original source manifest and measured quality\nSHA-256 identifies exact input files. Duplicate value rows are reported and retained: identical readings do not establish duplicated events. Prep.csv is not merged as an additional experiment.')
code('''frames, manifest = research_sources()
assert len(frames) == 4, "Provide all four original dataset folders; do not replace missing data with entered values."
display(manifest)
quality = quality_summary(frames)
display(quality)
print("Measured source rows:", int(quality.rows.sum()))''')
md('## 2. Research targets and descriptive statistics\nSample standard deviation uses ddof=1. Quantiles are calculated from the actual numeric observations. Vb, Ra and CycleToFailure are separate targets; correlation is not a causal claim. Unmapped sensor units are not converted into RPM or acceleration.')
code('''targets = {"tool_wear":["Vb"], "turning_roughness":["Ra"], "mill_telemetry":["S1_ActualVelocity","S1_OutputCurrent","M1_CURRENT_FEEDRATE"], "milling_life":["CycleToFailure","CycleToFailureNormalized"]}
research_stats = {}
for name, columns in targets.items():
    print("Dataset:", name)
    summary = numeric_summary(frames[name], columns)
    assert not summary.empty, "Expected source target columns are unavailable"
    research_stats[name] = summary.to_dict("records")
    display(summary)
display(frames["turning_roughness"].groupby("_source_file").Ra.agg(["count","mean","median","std","min","max"]))''')
code('''fig, ax = plt.subplots(1,2,figsize=(11,4))
pd.to_numeric(frames["tool_wear"]["Vb"],errors="coerce").dropna().plot.hist(bins=25,ax=ax[0],color="#168b84")
ax[0].set(title="Tool-wear source: Vb distribution",xlabel="Vb (raw source units; physical unit not verified)",ylabel="Observations")
for filename, group in frames["turning_roughness"].groupby("_source_file"):
    pd.to_numeric(group.Ra,errors="coerce").dropna().plot.hist(bins=25,alpha=.5,ax=ax[1],label=filename)
ax[1].set(title="Turning source: roughness distribution",xlabel="Ra (raw source target)",ylabel="Observations");ax[1].legend()
fig.tight_layout();plt.show()''')
md('## 3. Leakage and invalid-value checks\nCycleToFailureNormalized is a transformation of the prediction target and must be excluded from a model predicting CycleToFailure. IDs and sequence fields are not predictive evidence by themselves. This notebook does not claim a trained or validated ML model.')
code('''life = frames["milling_life"]
print("Exclude from predictors:", [c for c in ["CycleToFailure", "CycleToFailureNormalized", "FileName", "SampleIndex"] if c in life])
print("Rows with non-numeric/missing tool-life target:", int(pd.to_numeric(life["CycleToFailure"],errors="coerce").isna().sum()))
print("Rows with non-numeric/missing Vb:", int(pd.to_numeric(frames["tool_wear"].Vb,errors="coerce").isna().sum()))
print("No rows were removed and no missing values were filled.")''')
md('## 4. Actual MySQL operational snapshot\nThis is the same latest-reading view imported by the saved Power BI report. We count each machine once and preserve sensor names, units, status, quality and source provenance. Research-table counts show whether CSV data is actually loaded in MySQL; absence/zero is not an ingestion success.')
code('''snapshot, mysql_research_tables = mysql_snapshot()
assert not snapshot.empty, "MySQL latest-reading view is empty"
checks = reconciliation(snapshot)
assert checks["duplicate_machine_sensor_keys"] == 0
assert checks["missing_reading_ids"] == 0
display(pd.DataFrame([checks]))
display(mysql_research_tables)
display(snapshot.groupby(["data_source","data_provenance","data_quality"],dropna=False).size().rename("rows").reset_index())
print("Readings range:", str(snapshot.reading_timestamp.min()), "to", str(snapshot.reading_timestamp.max()))''')
code('''stats = live_statistics(snapshot)
display(stats)
invalid = snapshot.loc[~snapshot.valid_numeric]
print("Excluded from numeric statistics (non-GOOD or invalid):", len(invalid))
bounded = snapshot.loc[snapshot.valid_numeric & snapshot.expected_min.notna() & snapshot.expected_max.notna()].copy()
bounded["outside_expected"] = (bounded.numeric_value < bounded.expected_min) | (bounded.numeric_value > bounded.expected_max)
display(bounded.groupby(["sensor_name","sensor_unit"]).outside_expected.agg(["count","sum"]).rename(columns={"sum":"outside_expected_count"}).reset_index())''')
code('''rpm = snapshot.loc[snapshot.valid_numeric & snapshot.sensor_name.eq("RPM") & snapshot.sensor_unit.eq("RPM")].sort_values("numeric_value",ascending=False)
fig, axes = plt.subplots(1,2,figsize=(12,4))
rpm.head(12).plot.barh(x="machine_code",y="numeric_value",ax=axes[0],color="#168b84",legend=False)
axes[0].invert_yaxis();axes[0].set(title="Latest RPM: 12 highest machines",xlabel="RPM",ylabel="Machine")
status = snapshot.sort_values("reading_timestamp").drop_duplicates("machine_id",keep="last").machine_status.value_counts()
status.plot.bar(ax=axes[1],color="#4e83b8");axes[1].set(title="Machine state: one latest status per machine",xlabel="State",ylabel="Machines")
fig.tight_layout();plt.show()''')
md('## 5. Independent reconciliation and saved evidence\nA second computation using Python standard-library statistics checks the pandas results. The evidence export records the exact snapshot hash, inputs and execution time. It contains sensor data only, no users or secrets. Statistics from different moments need not match a later live refresh.')
code('''import statistics
for row in stats.to_dict("records"):
    values = snapshot.loc[snapshot.valid_numeric & snapshot.sensor_name.eq(row["sensor_name"]) & snapshot.sensor_unit.eq(row["sensor_unit"]),"numeric_value"].tolist()
    assert len(values) == row["count"]
    assert np.isclose(statistics.mean(values), row["mean"])
    assert np.isclose(statistics.median(values), row["median"])
    if len(values)>1: assert np.isclose(statistics.stdev(values),row["std"])
out = ROOT / "reports" / "phase1"
out.mkdir(parents=True,exist_ok=True)
snapshot.to_csv(out/"mysql_latest_snapshot.csv",index=False)
stats.to_csv(out/"mysql_sensor_statistics.csv",index=False)
manifest.to_csv(out/"research_source_manifest.csv",index=False)
evidence = {"executed_at_utc":executed_at,"source":"FactoryPulse MySQL latest view + original local CSV files","snapshot":checks,"research_quality":quality.to_dict("records"),"research_statistics":research_stats,"mysql_research_tables":mysql_research_tables.to_dict("records"),"independent_statistics_match":True,"database_writes":False,"limits":["Operational readings are simulator-generated","Latest view is not history","No trained ML model","MTBF and financial rates are not inferred"]}
(out/"notebook_evidence.json").write_text(json.dumps(evidence,indent=2,default=str),encoding="utf-8")
print("Independent statistics checks passed; evidence saved to reports/phase1.")''')
md('## Interpretation and limits\nThe saved outputs prove this execution against identified sources. They do not certify industrial equipment, business costs or production accounting. Latest snapshots show fleet comparisons, not historical OEE. Non-GOOD values are excluded from arithmetic, not deleted from storage. Cumulative production counters must use reset-aware deltas over a defined shift, never sums of samples. MySQL remains the operational source of truth; no Supabase query proxy is involved.')
nb=n.v4.new_notebook(cells=cells,metadata={'kernelspec':{'display_name':'FactoryPulse Python','language':'python','name':'python3'},'language_info':{'name':'python','version':'3.12'}})
n.write(nb,ROOT/'notebooks/eda_manufacturing_datasets.ipynb')
print('Notebook generated with source-derived calculations.')
