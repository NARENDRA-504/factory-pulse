"""Read-only EDA: audit problems before attempting corrections."""
from pathlib import Path
import json
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent
def main():
 raw=pd.read_csv(ROOT/'data/telemetry_raw.csv')
 labels=pd.read_csv(ROOT/'data/training_labels.csv')
 audit={'raw_rows':len(raw),'unique_packet_ids':raw.packet_id.nunique(),
  'duplicate_packet_rows':int(raw.packet_id.duplicated().sum()),'exact_duplicate_rows':int(raw.duplicated().sum()),
  'missing_by_column':raw.isna().sum().to_dict(),
  'temperature_units':raw.temperature_unit.value_counts(dropna=False).to_dict(),
  'pressure_units':raw.pressure_unit.value_counts(dropna=False).to_dict(),
  'quality_flags':raw.quality_flag.value_counts(dropna=False).to_dict(),
  'target_counts':labels.health_priority.value_counts(dropna=False).to_dict()}
 out=ROOT/'artifacts';out.mkdir(exist_ok=True)
 (out/'raw-audit.json').write_text(json.dumps(audit,indent=2,default=str),encoding='utf-8')
 print(json.dumps(audit,indent=2,default=str))
 counts=labels.health_priority.value_counts()
 counts.plot.bar(color=['#087f8c','#df8e24','#b84646','#6d6f82','#b3bcc4'][:len(counts)])
 plt.ylabel('Observations');plt.title('Label imbalance · fictional data');plt.xticks(rotation=30,ha='right')
 plt.tight_layout();plt.savefig(out/'class-balance.png',dpi=150);plt.close()
 print('No raw data changed. See artifacts/raw-audit.json and class-balance.png.')

if __name__=='__main__':main()
