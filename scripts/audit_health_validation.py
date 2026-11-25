"""Recompute deployed JSON inference on the existing time holdout, without training or promotion.
The already examined synthetic holdout is not an independent real-machine benchmark.
"""
import csv
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from api_server.health_model import forest_bundle,FEATURES,LABELS
from api_server.forest_inference import forest_scores

def wilson(success,total):
    if not total:return None
    z=1.96;p=success/total;den=1+z*z/total
    center=(p+z*z/(2*total))/den
    half=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den
    return [max(0,center-half),min(1,center+half)]

def timestamp(value):return dt.datetime.fromisoformat(value.replace('Z','+00:00'))

def main():
    model,original=forest_bundle()
    source=ROOT/'practice/machine-health-challenge'
    plan=json.loads((source/'split_plan.json').read_text())
    matrix=[[0]*3 for _ in LABELS];by_machine={};seen=set();overlap=False;hashes={}
    for split in ('train','validation','test'):
        path=source/'outputs'/f'{split}.csv'
        hashes[split]=hashlib.sha256(path.read_bytes()).hexdigest()
        if hashes[split]!=original['split_audit'][split]['sha256']:
            raise ValueError('Source snapshot differs from training evidence; audit stopped')
        start=timestamp(plan[split]['start_inclusive']);end=timestamp(plan[split]['end_exclusive'])-dt.timedelta(minutes=120)
        with path.open(newline='',encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                try:
                    stamp=timestamp(row['observed_at_utc']);values={k:float(row[k]) for k in FEATURES}
                    valid=start<=stamp<end and row['quality_flag']=='GOOD' and row['machine_state']!='DOWN' and row['health_priority'] in LABELS and all(math.isfinite(v) for v in values.values())
                except (ValueError,KeyError):continue
                if not valid:continue
                if row['packet_id'] in seen:overlap=True
                seen.add(row['packet_id'])
                if split!='test':continue
                scores=forest_scores(model,values);prediction=max(scores,key=scores.get)
                actual=row['health_priority'];i=LABELS.index(actual);j=LABELS.index(prediction);matrix[i][j]+=1
                item=by_machine.setdefault(row['machine_id'],{'samples':0,'critical_actual':0,'critical_detected':0,'false_critical':0})
                item['samples']+=1;item['critical_actual']+=actual=='Critical';item['critical_detected']+=actual==prediction=='Critical';item['false_critical']+=prediction=='Critical' and actual!='Critical'
    if overlap:raise ValueError('Duplicate observation leakage detected')
    if matrix!=original['test']['confusion_matrix']:raise ValueError('Deployed inference does not reproduce saved holdout metrics')
    ci=LABELS.index('Critical');tp=matrix[ci][ci];actual=sum(matrix[ci]);predicted=sum(row[ci] for row in matrix)
    report={'checked_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'model_sha256':original['model_sha256'],'source_hashes_match':True,'duplicate_packet_overlap':False,
        'deployed_inference_matches':True,'test_samples':sum(map(sum,matrix)),'matrix_order':LABELS,'confusion_matrix':matrix,
        'critical_recall':tp/actual if actual else None,'critical_recall_95pct_interval':wilson(tp,actual),
        'critical_precision':tp/predicted if predicted else None,'critical_precision_95pct_interval':wilson(tp,predicted),
        'by_machine':by_machine,'alerts_enabled':False,'real_machine_validation':False,
        'limitations':['Existing synthetic holdout has already been examined; it is not a fresh blind test.',
            'Same machines occur across time splits; unseen-machine performance is unverified.',
            'Confidence intervals assume independent samples; correlated machine windows can make them optimistic.',
            'No threshold tuning, retraining, live SQL access or model promotion was performed.']}
    target=ROOT/'.local/health-model-v2/validation-audit.json';target.write_text(json.dumps(report,indent=2))
    print(json.dumps({k:report[k] for k in ('deployed_inference_matches','test_samples','critical_recall','critical_precision','alerts_enabled')}))
if __name__=='__main__':main()
