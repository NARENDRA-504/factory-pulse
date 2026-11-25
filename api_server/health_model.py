"""Small JSON-only Gaussian Naive Bayes baseline. Shadow predictions never write incidents."""
import datetime as dt
import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
from .forest_inference import forest_scores

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'.local/health-model/model.json'
REPORT=ROOT/'.local/health-model/evaluation.json'
FOREST_MODEL=ROOT/'.local/health-model-v2/model.json'
FOREST_REPORT=ROOT/'.local/health-model-v2/evaluation.json'
FEATURES={'temperature_c':('Temperature','°C'),'vibration':('Vibration','mm/s'),
 'spindle_rpm':('RPM','RPM'),'motor_current_a':('Current','A'),
 'motor_load_pct':('Motor Load','%'),'pressure_bar':('Pressure','bar'),
 'coolant_flow_l_min':('Coolant Flow','L/min')}
LABELS=('Normal','Suspect','Critical')

@lru_cache(maxsize=2)
def load_forest(model_stamp, report_stamp):
    raw=FOREST_MODEL.read_bytes()
    if len(raw)>15_000_000:raise ValueError('Model exceeds size bound')
    report=json.loads(FOREST_REPORT.read_text(encoding='utf-8'));model=json.loads(raw)
    if hashlib.sha256(raw).hexdigest()!=report['model_sha256']:raise ValueError('Model checksum mismatch')
    if model.get('version')!=2 or model.get('features')!=list(FEATURES) or set(model.get('labels',[]))!=set(LABELS):raise ValueError('Feature contract mismatch')
    forest_scores(model,{k:sum(model['ranges'][k])/2 for k in FEATURES})
    return model,report

def forest_bundle():
    return load_forest(FOREST_MODEL.stat().st_mtime_ns,FOREST_REPORT.stat().st_mtime_ns)

def scores(model,values):
    if list(model['features'])!=list(FEATURES):raise ValueError('Feature contract mismatch')
    if any(not isinstance(values.get(k),(float,int)) or isinstance(values[k],bool) or not math.isfinite(values[k]) for k in FEATURES):
        raise ValueError('All finite numeric features are required')
    result={}
    for label in LABELS:
        p=model['classes'][label]
        result[label]=math.log(p['prior'])+sum(-.5*(math.log(2*math.pi*max(p['variance'][k],1e-6))+(values[k]-p['mean'][k])**2/max(p['variance'][k],1e-6)) for k in FEATURES)
    offset=max(result.values());prob={k:math.exp(v-offset) for k,v in result.items()};total=sum(prob.values())
    return {k:v/total for k,v in prob.items()}

@lru_cache(maxsize=2)
def load_model(mtime):
    raw=MODEL.read_bytes()
    if len(raw)>100000:raise ValueError('Model exceeds size limit')
    model=json.loads(raw);report=json.loads(REPORT.read_text(encoding='utf-8'))
    if hashlib.sha256(raw).hexdigest()!=report['model_sha256']:raise ValueError('Model checksum mismatch')
    return model,report

def model_status():
    try:
        if FOREST_MODEL.exists():
            model,r=forest_bundle()
            return {'status':'shadow_only','model':r['model_name'],'version':2,
                    'training_source':r['training_source'],'validation':r['validation'],'test':r['test'],
                    'majority_test_accuracy':r['majority_test_accuracy'],'trained_at_utc':r['trained_at_utc'],
                    'model_sha256':r['model_sha256'],'release_gate':r['release_gate'],'alerts_enabled':False,
                    'feature_importance':model['feature_importance'],
                    'notice':'Trained seven-sensor early-warning model deployed locally in shadow mode. Synthetic-data validation only; predictions do not create incidents or authorize equipment operation.'}
        _,r=load_model(MODEL.stat().st_mtime_ns)
        return {'status':'shadow_only','model':'Gaussian Naive Bayes','training_source':'fictional practice dataset',
                'validation':r['validation'],'test':r['test'],'majority_test_accuracy':r['majority_test_accuracy'],
                'trained_at_utc':r['trained_at_utc'],'alerts_enabled':False,
                'notice':'Research baseline only. No real-machine validation, calibrated risk or failure diagnosis is claimed.'}
    except (OSError,ValueError,KeyError,TypeError,IndexError,OverflowError):
        return {'status':'unavailable','alerts_enabled':False,'notice':'Train and verify the local practice baseline first.'}

def predict_machine(rows,now):
    result = _predict_machine(rows, now)
    result['checked_at'] = now.isoformat()
    result['max_reading_age_seconds'] = 30
    result['max_alignment_seconds'] = 5
    status = model_status()
    result.setdefault('version', status.get('version'))
    result.setdefault('model', status.get('model'))
    result['advisory_only'] = True
    result['alerts_enabled'] = False
    return result


def _predict_machine(rows,now):
    status=model_status()
    if status['status']=='unavailable':return status
    if len({r.get('machine_id') for r in rows if r.get('machine_id')})>1:
        return {'status':'insufficient_data','alerts_enabled':False,'notice':'A prediction must contain one authorized machine only.'}
    by_sensor={};missing=[];values={};stamps=[];ids=[]
    for r in rows:
        name=r.get('sensor_name')
        if name not in by_sensor or str(r.get('timestamp',''))>str(by_sensor[name].get('timestamp','')):by_sensor[name]=r
    if any(r.get('machine_status') in {'STOPPED','MAINTENANCE'} for r in by_sensor.values()):
        return {'status':'not_applicable','alerts_enabled':False,
                'notice':'Machine is stopped or in maintenance. The early-warning model is not used to clear an existing stop or authorize restart.'}
    for key,(sensor,unit) in FEATURES.items():
        r=by_sensor.get(sensor,{})
        try:
            stamp=dt.datetime.fromisoformat(str(r['timestamp']).replace('Z','+00:00'))
            if stamp.tzinfo is None:stamp=stamp.replace(tzinfo=dt.timezone.utc)
            value=r['sensor_value']
            if r.get('data_quality')!='GOOD' or r.get('sensor_unit')!=unit or not 0<=(now-stamp).total_seconds()<=30:raise ValueError()
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError()
            values[key]=value;stamps.append(stamp);ids.append(r.get('reading_id'))
        except (KeyError,ValueError,TypeError):missing.append(sensor)
    if missing or (stamps and (max(stamps)-min(stamps)).total_seconds()>5):
        return {'status':'insufficient_data','missing_or_invalid_sensors':missing,'alerts_enabled':False,
                'notice':'Requires all seven GOOD, correctly unit-labeled readings within 30s, aligned within 5s.'}
    try:
        if status.get('version')==2:
            model,report=forest_bundle();prob=forest_scores(model,values)
        else:
            model,_=load_model(MODEL.stat().st_mtime_ns);prob=scores(model,values)
    except (OSError,ValueError,KeyError,TypeError,IndexError,OverflowError):
        return {'status':'unavailable','alerts_enabled':False,'notice':'Model validation failed; threshold alerts and telemetry remain independent.'}
    return {'status':'shadow_only','classification':max(prob,key=prob.get),'relative_scores':prob,
            'model':status.get('model'),'version':status.get('version',1),
            'prediction_target':'Critical: failure within 30 minutes; Suspect: 30 to 120 minutes; Normal: no failure within 120 minutes in the synthetic training labels.',
            'review_required':True,
            'outside_training_range':[k for k,v in values.items() if not model['ranges'][k][0]<=v<=model['ranges'][k][1]],
            'reading_ids':ids,'latest_reading_at':max(stamps).isoformat(),'alerts_enabled':False,
            'notice':'Synthetic-data model; relative scores are not calibrated failure probabilities. Never authorizes equipment operation.'}
