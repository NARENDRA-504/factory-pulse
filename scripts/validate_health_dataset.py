"""Validate a candidate labeled dataset without training, SQL access or model promotion."""
import argparse,csv,datetime as dt,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api_server.health_model import FEATURES,LABELS

def validate(rows):
    errors=[];seen=set();groups={};times={};classes={};machines={};count=0
    required={'packet_id','machine_id','observed_at_utc','fault_event_id','split','label_source','quality_flag','health_priority',*FEATURES}
    for line,row in enumerate(rows,2):
        count+=1
        if required-set(row):return {'valid':False,'rows':count,'errors':['Required columns are missing'],'release_authorized':False}
        try:
            if not row['packet_id'] or row['packet_id'] in seen:raise ValueError('missing or duplicate packet ID')
            seen.add(row['packet_id'])
            split=row['split'];label=row['health_priority']
            if split not in ('train','validation','test') or label not in LABELS:raise ValueError('unknown split or label')
            if row['label_source'] not in ('site_reviewed','synthetic'):raise ValueError('label source must be recorded')
            if row['quality_flag']!='GOOD':raise ValueError('only quality-reviewed GOOD rows belong in the model dataset')
            stamp=dt.datetime.fromisoformat(row['observed_at_utc'].replace('Z','+00:00'))
            if stamp.tzinfo is None:raise ValueError('timestamp must include UTC offset')
            if not row['machine_id'].strip() or not row['fault_event_id'].strip():raise ValueError('machine and event group are required')
            values={k:float(row[k]) for k in FEATURES}
            if not all(math.isfinite(v) for v in values.values()):raise ValueError('nonfinite sensor value')
            if any(values[k]<0 for k in FEATURES if k!='temperature_c'):raise ValueError('negative physical sensor value')
            group=(row['machine_id'],row['fault_event_id'])
            if group in groups and groups[group]!=split:raise ValueError('fault event leaks across splits')
            groups[group]=split;times.setdefault(split,[]).append(stamp);classes.setdefault(split,set()).add(label);machines.setdefault(split,set()).add(row['machine_id'])
        except (ValueError,TypeError,KeyError) as exc:
            if len(errors)<50:errors.append(f'Line {line}: {exc}')
    if count==0:errors.append('Dataset is empty; no invented samples were supplied')
    for split in ('train','validation','test'):
        if classes.get(split,set())!=set(LABELS):errors.append(split+': all three reviewed label classes are required')
    for earlier,later in (('train','validation'),('validation','test')):
        if times.get(earlier) and times.get(later) and min(times[later])-max(times[earlier])<dt.timedelta(minutes=120):
            errors.append(earlier+'/'+later+': two-hour label-horizon gap is missing')
    return {'valid':not errors,'rows':count,'errors':errors,'release_authorized':False,
            'test_machines_seen_in_train':len(machines.get('train',set())&machines.get('test',set())),
            'notice':'Checks do not authenticate label provenance or authorize model alerts. Site-reviewed labels still need independent review and an untouched final holdout.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('dataset',type=Path);args=p.parse_args()
    with args.dataset.open(newline='',encoding='utf-8-sig') as f:result=validate(csv.DictReader(f))
    print(json.dumps(result,indent=2));return 0 if result['valid'] else 1
if __name__=='__main__':raise SystemExit(main())
