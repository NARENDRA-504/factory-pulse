"""Deterministic chronological practice baseline. Never reads MySQL or sends data."""
import csv,datetime as dt,hashlib,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api_server.health_model import ROOT,FEATURES,LABELS,MODEL,REPORT,scores

SOURCE=ROOT/'practice/machine-health-challenge'
def records(path,window):
    out=[];excluded=0;seen=set()
    start=dt.datetime.fromisoformat(window['start_inclusive']);end=dt.datetime.fromisoformat(window['end_exclusive'])-dt.timedelta(minutes=120)
    with path.open(encoding='utf-8-sig',newline='') as f:
        for r in csv.DictReader(f):
            try:
                stamp=dt.datetime.fromisoformat(r['observed_at_utc'])
                if not start<=stamp<end or r['health_priority'] not in LABELS or r['quality_flag']!='GOOD' or r['machine_state']=='DOWN':raise ValueError()
                if r['packet_id'] in seen:raise ValueError('Duplicate observation')
                values={k:float(r[k]) for k in FEATURES}
                if not all(math.isfinite(v) for v in values.values()):raise ValueError()
                seen.add(r['packet_id']);out.append((r['packet_id'],r['health_priority'],values))
            except (KeyError,ValueError):excluded+=1
    if not out:raise ValueError('No eligible rows in '+str(path))
    return out,excluded

def evaluate(model,rows):
    matrix={a:{b:0 for b in LABELS} for a in LABELS}
    for _,actual,v in rows:matrix[actual][max(scores(model,v),key=scores(model,v).get)]+=1
    recall={a:matrix[a][a]/sum(matrix[a].values()) if sum(matrix[a].values()) else None for a in LABELS}
    precision={a:matrix[a][a]/sum(matrix[b][a] for b in LABELS) if sum(matrix[b][a] for b in LABELS) else None for a in LABELS}
    return {'rows':len(rows),'accuracy':sum(matrix[a][a] for a in LABELS)/len(rows),
            'macro_recall':sum(v or 0 for v in recall.values())/len(LABELS),'precision':precision,'recall':recall,'confusion_matrix':matrix}

def main():
    plan=json.loads((SOURCE/'split_plan.json').read_text());data={};excluded={};hashes={}
    for split in ('train','validation','test'):
        path=SOURCE/'outputs'/f'{split}.csv';data[split],excluded[split]=records(path,plan[split]);hashes[split]=hashlib.sha256(path.read_bytes()).hexdigest()
    ids={k:{r[0] for r in v} for k,v in data.items()}
    if ids['train']&ids['validation'] or ids['train']&ids['test'] or ids['validation']&ids['test']:raise ValueError('Split leakage: overlapping observation IDs')
    model={'version':1,'features':list(FEATURES),'classes':{},'ranges':{k:[min(r[2][k] for r in data['train']),max(r[2][k] for r in data['train'])] for k in FEATURES}}
    for label in LABELS:
        rows=[v for _,a,v in data['train'] if a==label]
        if len(rows)<2:raise ValueError('Insufficient training examples for '+label)
        means={k:sum(r[k] for r in rows)/len(rows) for k in FEATURES}
        model['classes'][label]={'prior':len(rows)/len(data['train']),'count':len(rows),'mean':means,
             'variance':{k:max(sum((r[k]-means[k])**2 for r in rows)/len(rows),1e-6) for k in FEATURES}}
    raw=json.dumps(model,sort_keys=True,indent=2).encode();majority=max(LABELS,key=lambda a:model['classes'][a]['count'])
    report={'trained_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'source':'fictional practice data; not physical factory validation',
        'model_sha256':hashlib.sha256(raw).hexdigest(),'source_sha256':hashes,'split':'fixed chronological windows; 120-minute outcome purge; no future outcome or identity features',
        'excluded_rows':excluded,'training_rows':len(data['train']),'validation':evaluate(model,data['validation']),'test':evaluate(model,data['test']),
        'majority_test_accuracy':sum(a==majority for _,a,_ in data['test'])/len(data['test']),'alerts_enabled':False}
    MODEL.parent.mkdir(exist_ok=True,parents=True);MODEL.write_bytes(raw);REPORT.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'training_rows':len(data['train']),'validation':report['validation'],'test':report['test'],'mode':'shadow_only'},indent=2))
if __name__=='__main__':main()
