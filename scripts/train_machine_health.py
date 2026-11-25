"""Train a seven-channel early-warning classifier; export data-only JSON for the app.

Run with the isolated practice environment. No SQL, credentials or sender imports.
"""
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import sklearn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api_server.health_model import FEATURES, LABELS
from api_server.forest_inference import forest_scores
OUT = ROOT/'.local/health-model-v2'

def evaluate(model, frame):
    actual=frame.health_priority; predicted=model.predict(frame[list(FEATURES)].to_numpy(dtype=np.float32))
    report=classification_report(actual,predicted,labels=list(LABELS),output_dict=True,zero_division=0)
    return {'rows':len(frame),'accuracy':report['accuracy'],
            'macro_f1':float(f1_score(actual,predicted,average='macro',zero_division=0)),
            'recall':{k:report[k]['recall'] for k in LABELS},
            'precision':{k:report[k]['precision'] for k in LABELS},
            'confusion_matrix':confusion_matrix(actual,predicted,labels=list(LABELS)).tolist(),
            'matrix_order':list(LABELS),
            'normal_to_critical_rate':float(((predicted=='Critical')&(actual=='Normal')).sum()/max(1,(actual=='Normal').sum()))}

def main():
    source=ROOT/'practice/machine-health-challenge'; plan=json.loads((source/'split_plan.json').read_text())
    splits={};audit={};seen=set()
    for split in ('train','validation','test'):
        path=source/'outputs'/f'{split}.csv'; raw=pd.read_csv(path)
        stamp=pd.to_datetime(raw.observed_at_utc,utc=True,errors='coerce')
        numeric=raw[list(FEATURES)].apply(pd.to_numeric,errors='coerce')
        mask=(stamp.ge(pd.Timestamp(plan[split]['start_inclusive'])) &
              stamp.lt(pd.Timestamp(plan[split]['end_exclusive'])-pd.Timedelta(minutes=120)) &
              raw.health_priority.isin(LABELS) & raw.quality_flag.eq('GOOD') & ~raw.machine_state.eq('DOWN') &
              np.isfinite(numeric).all(axis=1))
        frame=raw.loc[mask].copy();frame[list(FEATURES)]=numeric.loc[mask]
        if frame.packet_id.duplicated().any() or seen.intersection(frame.packet_id):raise ValueError('Duplicate observation leakage')
        if set(frame.health_priority)!=set(LABELS):raise ValueError('Missing label class')
        seen.update(frame.packet_id);splits[split]=frame
        audit[split]={'rows':len(frame),'excluded':int((~mask).sum()),'class_counts':frame.health_priority.value_counts().to_dict(),
                      'first_utc':str(stamp[mask].min()),'last_utc':str(stamp[mask].max()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    candidates={
        'majority':DummyClassifier(strategy='most_frequent'),
        'balanced_logistic':make_pipeline(StandardScaler(),LogisticRegression(class_weight='balanced',max_iter=1000,random_state=42)),
        'balanced_random_forest':RandomForestClassifier(n_estimators=120,max_depth=12,min_samples_leaf=3,class_weight='balanced_subsample',random_state=42,n_jobs=2),
        'balanced_extra_trees':ExtraTreesClassifier(n_estimators=120,max_depth=12,min_samples_leaf=3,class_weight='balanced',random_state=42,n_jobs=2)}
    validation={}
    x=splits['train'][list(FEATURES)].to_numpy(dtype=np.float32);y=splits['train'].health_priority
    for name,model in candidates.items():
        model.fit(x,y);validation[name]=evaluate(model,splits['validation'])
        print(name, 'validation macro F1',round(validation[name]['macro_f1'],4),flush=True)
    # Select only among exportable tree candidates; compare logistic and majority as baselines.
    selected=max(('balanced_random_forest','balanced_extra_trees'),key=lambda n:validation[n]['macro_f1'])
    model=candidates[selected];test=evaluate(model,splits['test'])
    exported={'version':2,'model_name':selected,'features':list(FEATURES),'labels':list(model.classes_),
              'ranges':{f:[float(x[:,i].min()),float(x[:,i].max())] for i,f in enumerate(FEATURES)},
              'feature_importance':dict(zip(FEATURES,map(float,model.feature_importances_))), 'trees':[]}
    for estimator in model.estimators_:
        tree=estimator.tree_;value=tree.value[:,0,:];value=value/value.sum(axis=1,keepdims=True)
        exported['trees'].append({'left':tree.children_left.tolist(),'right':tree.children_right.tolist(),
                                 'feature':tree.feature.tolist(),'threshold':tree.threshold.tolist(),'probabilities':value.tolist()})
    probe=splits['test'][list(FEATURES)].to_numpy(dtype=np.float32)[:500]
    reference=model.predict_proba(probe)
    actual=np.array([[forest_scores(exported,dict(zip(FEATURES,map(float,row))))[label] for label in model.classes_] for row in probe])
    parity=float(np.max(np.abs(reference-actual)))
    if parity>1e-9:raise ValueError('JSON deployment parity failed')
    OUT.mkdir(parents=True,exist_ok=True)
    raw=json.dumps(exported,separators=(',',':'),allow_nan=False).encode()
    report={'model_name':selected,'trained_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
            'sklearn_version':sklearn.__version__,'model_sha256':hashlib.sha256(raw).hexdigest(),
            'training_source':'Fictional machine-health challenge; no physical failure validation',
            'selection':'Highest validation macro F1 among tree ensembles; logistic and majority are comparison baselines',
            'split_audit':audit,'validation':validation,'test':test,
            'majority_test_accuracy':evaluate(candidates['majority'],splits['test'])['accuracy'],
            'deployment_parity_rows':len(probe),'max_score_error':parity,
            'alerts_enabled':False,'release_gate':{'real_machine_validation':False,
                'critical_recall_at_least_90_percent':test['recall']['Critical']>=.9,
                'critical_precision_at_least_80_percent':test['precision']['Critical']>=.8},
            'limitations':['Synthetic labels represent future failure proximity, not current physical diagnosis.',
                'Same fictional machines appear across time splits; not unseen-machine validation.',
                'This test set was examined in earlier exercises; not a fresh blind benchmark.',
                'Scores are uncalibrated. Event-level lead time and alert burden are unverified.',
                'Motor Load in the current sender is a torque-based proxy; domain mismatch needs real sensor validation.']}
    (OUT/'model.json').write_bytes(raw)
    (OUT/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    sample=splits['test'].iloc[0]
    (OUT/'sample.json').write_text(json.dumps({k:float(sample[k]) for k in FEATURES},indent=2))
    import matplotlib;matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from sklearn.metrics import ConfusionMatrixDisplay
    ConfusionMatrixDisplay(np.array(test['confusion_matrix']),display_labels=list(LABELS)).plot(cmap='Blues',values_format='d')
    plt.title('Machine health time holdout synthetic data');plt.tight_layout();plt.savefig(OUT/'confusion-matrix.png',dpi=150);plt.close()
    print(json.dumps({'selected':selected,'test':test,'parity':parity,'artifact_bytes':len(raw)},indent=2))

if __name__=='__main__':main()
