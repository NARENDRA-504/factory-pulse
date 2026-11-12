"""Reproducible real-data classification exercise. No FactoryPulse imports."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, io, json, platform, urllib.request, zipfile
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, average_precision_score, confusion_matrix,
    precision_score, recall_score, f1_score, roc_auc_score, brier_score_loss)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT=Path(__file__).resolve().parent
NUMERIC=['Administrative','Administrative_Duration','Informational','Informational_Duration','ProductRelated','ProductRelated_Duration']
CATEGORICAL=['Month','VisitorType','Weekend']
FEATURES=NUMERIC+CATEGORICAL
SOURCE='https://archive.ics.uci.edu/static/public/468/online+shoppers+purchasing+intention+dataset.zip'

def metrics(y,p,threshold):
    predicted=(p>=threshold).astype(int)
    return dict(accuracy=float(accuracy_score(y,predicted)),precision=float(precision_score(y,predicted,zero_division=0)),
        recall=float(recall_score(y,predicted,zero_division=0)),f1=float(f1_score(y,predicted,zero_division=0)),
        average_precision=float(average_precision_score(y,p)),roc_auc=float(roc_auc_score(y,p)),
        brier_score=float(brier_score_loss(y,p)),confusion_matrix=confusion_matrix(y,predicted,labels=[0,1]).tolist())

def main():
    data_dir=ROOT/'data'; artifacts=ROOT/'artifacts'
    data_dir.mkdir(exist_ok=True);artifacts.mkdir(exist_ok=True)
    csv_path=data_dir/'online_shoppers_intention.csv'
    if not csv_path.exists():
        with urllib.request.urlopen(SOURCE,timeout=60) as response: payload=response.read()
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            name=next(n for n in archive.namelist() if n.endswith('online_shoppers_intention.csv'))
            csv_path.write_bytes(archive.read(name))
    raw=pd.read_csv(csv_path)
    if len(raw)!=12330 or not set(FEATURES+['Revenue']).issubset(raw.columns):
        raise ValueError('Unexpected source dataset shape or schema; inspect before training.')
    if raw['Revenue'].isna().any():raise ValueError('Missing target labels.')
    frame=raw.drop_duplicates().reset_index(drop=True)
    X=frame[FEATURES].copy(); y=frame['Revenue'].astype(int)
    # Identical selected feature vectors stay together, even with differing outcomes.
    groups=pd.util.hash_pandas_object(X,index=False)
    first=GroupShuffleSplit(n_splits=1,test_size=.15,random_state=42)
    remaining,test=next(first.split(X,y,groups))
    second=GroupShuffleSplit(n_splits=1,test_size=.15/.85,random_state=43)
    tr,va=next(second.split(X.iloc[remaining],y.iloc[remaining],groups.iloc[remaining]))
    train,validation=remaining[tr],remaining[va]
    partitions={'train':train,'validation':validation,'test':test}
    for a,b in [('train','validation'),('train','test'),('validation','test')]:
        assert not set(groups.iloc[partitions[a]]) & set(groups.iloc[partitions[b]])
    split_details={}
    for name,idx in partitions.items():
        frame.iloc[idx][FEATURES+['Revenue']].to_csv(data_dir/f'{name}.csv',index=False)
        split_details[name]={'rows':len(idx),'purchases':int(y.iloc[idx].sum()),'purchase_rate':float(y.iloc[idx].mean())}
    def preprocessor():
        return ColumnTransformer([
            ('numeric',Pipeline([('impute',SimpleImputer(strategy='median')),('scale',StandardScaler())]),NUMERIC),
            ('categorical',Pipeline([('impute',SimpleImputer(strategy='most_frequent')),('encode',OneHotEncoder(handle_unknown='ignore'))]),CATEGORICAL)])
    candidates={
        'logistic_regression':LogisticRegression(max_iter=2000,class_weight='balanced',random_state=42),
        'random_forest':RandomForestClassifier(n_estimators=200,max_depth=12,min_samples_leaf=8,class_weight='balanced_subsample',random_state=42,n_jobs=2)
    }
    fitted={};scores={}
    for name,estimator in candidates.items():
        pipe=Pipeline([('preprocess',preprocessor()),('model',estimator)])
        pipe.fit(X.iloc[train],y.iloc[train]);fitted[name]=pipe
        scores[name]=metrics(y.iloc[validation],pipe.predict_proba(X.iloc[validation])[:,1],.5)
        print(f'{name}: validation average precision={scores[name]["average_precision"]:.4f}',flush=True)
    winner=max(scores,key=lambda name:scores[name]['average_precision'])
    model=fitted[winner];vp=model.predict_proba(X.iloc[validation])[:,1]
    thresholds=np.arange(.05,.951,.01)
    threshold=float(max(thresholds,key=lambda t:f1_score(y.iloc[validation],vp>=t,zero_division=0)))
    # Test set consulted only after model and threshold are selected on validation.
    tp=model.predict_proba(X.iloc[test])[:,1]
    report={
        'created_at_utc':datetime.now(timezone.utc).isoformat(),'dataset_source':SOURCE,
        'source_sha256':hashlib.sha256(csv_path.read_bytes()).hexdigest(),'source_rows':len(raw),
        'exact_duplicate_rows_removed':len(raw)-len(frame),'features':FEATURES,
        'excluded_columns':sorted(set(raw.columns)-set(FEATURES)-{'Revenue'}),
        'split_method':'Fixed random grouped split; identical selected features never cross partitions. Not a temporal holdout.',
        'splits':split_details,'validation_models_at_threshold_0_5':scores,
        'selected_model':winner,'threshold':threshold,'threshold_rule':'Maximum validation F1 across 0.05 to 0.95; not optimized business profit.',
        'test':metrics(y.iloc[test],tp,threshold),
        'test_constant_score_baseline':metrics(y.iloc[test],np.full(len(test),float(y.iloc[train].mean())),.5),
        'versions':{'python':platform.python_version(),'scikit_learn':sklearn.__version__,'pandas':pd.__version__,'joblib':joblib.__version__},
        'limitations':['Historical 2018 donation; not current commerce behavior.','End-of-session labels and aggregates; no event-level timing. Offline exercise does not verify real-time predictions.',
            'PageValues, BounceRates and ExitRates excluded to reduce outcome/timing leakage. Remaining session totals still need event-time validation for production.',
            'Risk scores are not guaranteed calibrated probabilities. No sales lift or causal marketing benefit is established.']}
    version='shopsense-'+report['source_sha256'][:8]+'-'+winner+'-v1'
    report['model_version']=version
    joblib.dump({'pipeline':model,'features':FEATURES,'threshold':threshold,'version':version},artifacts/'model.joblib')
    (artifacts/'metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    examples=[]
    for idx in test[:3]:
        row=X.loc[idx].to_dict();row['Weekend']=bool(row['Weekend'])
        examples.append(row)
    (ROOT/'example_request.json').write_text(json.dumps(examples[0],indent=2),encoding='utf-8')
    print(json.dumps({'selected_model':winner,'threshold':threshold,'test':report['test'],'splits':split_details},indent=2))

if __name__=='__main__':main()
