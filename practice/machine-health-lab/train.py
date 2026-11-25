"""Practice only: fixed chronological evaluation, no operational app imports."""
from pathlib import Path
import hashlib,json,platform
import joblib,numpy as np,pandas as pd,sklearn
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report,confusion_matrix,f1_score,balanced_accuracy_score,average_precision_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder,StandardScaler

ROOT=Path(__file__).resolve().parent
NUMERIC=['temperature_c','vibration','spindle_rpm','motor_current_a','motor_load_pct',
         'pressure_bar','coolant_flow_l_min','ambient_temperature_c','hours_since_service']
CATEGORICAL=['machine_type']
FEATURES=NUMERIC+CATEGORICAL
LABELS=['Normal','Suspect','Critical']

def load_splits():
 plan=json.loads((ROOT/'data/split_plan.json').read_text())
 splits={};audit={};seen=set()
 for name in ['train','validation','test']:
  path=ROOT/'data'/f'{name}.csv';frame=pd.read_csv(path)
  stamps=pd.to_datetime(frame['observed_at_utc'],utc=True,errors='coerce')
  start=pd.Timestamp(plan[name]['start_inclusive'])
  end=pd.Timestamp(plan[name]['end_exclusive'])-pd.Timedelta(minutes=120)
  eligible=stamps.ge(start)&stamps.lt(end)&frame.health_priority.isin(LABELS)&frame.quality_flag.eq('GOOD')&~frame.machine_state.eq('DOWN')
  kept=frame.loc[eligible].copy()
  if kept.packet_id.duplicated().any() or seen.intersection(kept.packet_id):raise ValueError('Duplicate packet leakage')
  seen.update(kept.packet_id)
  for col in NUMERIC:kept[col]=pd.to_numeric(kept[col],errors='coerce').replace([np.inf,-np.inf],np.nan)
  if set(kept.health_priority)!=set(LABELS):raise ValueError('A split is missing a target class')
  splits[name]=kept
  audit[name]={'input_rows':len(frame),'eligible_rows':len(kept),'excluded_rows':int((~eligible).sum()),
   'class_counts':kept.health_priority.value_counts().to_dict(),'first_utc':str(stamps[eligible].min()),
   'last_utc':str(stamps[eligible].max()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 return splits,audit

def pipeline(classifier):
 prep=ColumnTransformer([
  ('numeric',Pipeline([('imputer',SimpleImputer(strategy='median',add_indicator=True)),('scaler',StandardScaler())]),NUMERIC),
  ('category',Pipeline([('imputer',SimpleImputer(strategy='most_frequent')),('encoder',OneHotEncoder(handle_unknown='ignore'))]),CATEGORICAL)])
 return Pipeline([('preprocess',prep),('classifier',classifier)])

def evaluate(model,frame):
 y=frame.health_priority;pred=model.predict(frame[FEATURES]);probs=model.predict_proba(frame[FEATURES]);classes=list(model.classes_)
 return {'rows':len(frame),'macro_f1':float(f1_score(y,pred,average='macro',zero_division=0)),
  'balanced_accuracy':float(balanced_accuracy_score(y,pred)),
  'classification_report':classification_report(y,pred,labels=LABELS,output_dict=True,zero_division=0),
  'confusion_matrix':confusion_matrix(y,pred,labels=LABELS).tolist(),'matrix_order':LABELS,
  'average_precision':{label:float(average_precision_score((y==label).astype(int),probs[:,classes.index(label)])) for label in ['Suspect','Critical']}}

def main():
 splits,audit=load_splits();out=ROOT/'artifacts';out.mkdir(exist_ok=True)
 candidates={'majority':DummyClassifier(strategy='most_frequent'),
  'logistic_balanced':LogisticRegression(class_weight='balanced',max_iter=1000,random_state=42),
  'random_forest_balanced':RandomForestClassifier(n_estimators=140,max_depth=14,min_samples_leaf=3,class_weight='balanced_subsample',random_state=42,n_jobs=2)}
 models={};validation={}
 for name,classifier in candidates.items():
  model=pipeline(classifier);model.fit(splits['train'][FEATURES],splits['train'].health_priority)
  models[name]=model;validation[name]=evaluate(model,splits['validation'])
  print(name,'validation macro F1',round(validation[name]['macro_f1'],4),flush=True)
 selected=max(validation,key=lambda n:validation[n]['macro_f1'])
 # Freeze model choice BEFORE evaluating test. Do not refit or select on test.
 model=models[selected];test=evaluate(model,splits['test'])
 path=out/'model.joblib';joblib.dump({'pipeline':model,'features':FEATURES,'labels':LABELS},path)
 report={'purpose':'Fictional practice only; future failure proximity, not a certified machine diagnosis',
  'selected_by':'highest validation macro-F1; test not used for selection','selected_model':selected,
  'python':platform.python_version(),'sklearn':sklearn.__version__,'split_audit':audit,'validation':validation,'test':test,
  'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'automatic_alerts_enabled':False,
  'limitations':['Synthetic data and repeated known machines; no real factory validation.',
   'Prior project experiments already inspected this test set: this is a learning exercise, not a new blind benchmark.',
   'Row-level evaluation does not establish event-level failure detection, alert burden or useful lead time.',
   'predict_proba values are uncalibrated model outputs, not guaranteed failure probabilities.']}
 (out/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 example={k:(float(splits['test'].iloc[0][k]) if k in NUMERIC else str(splits['test'].iloc[0][k])) for k in FEATURES}
 (out/'sample-request.json').write_text(json.dumps(example,indent=2),encoding='utf-8')
 import matplotlib
 matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 from sklearn.metrics import ConfusionMatrixDisplay
 ConfusionMatrixDisplay(np.array(test['confusion_matrix']),display_labels=LABELS).plot(cmap='Blues',values_format='d')
 plt.title('Held-out time period · fictional practice data');plt.tight_layout();plt.savefig(out/'confusion-matrix.png',dpi=150);plt.close()
 print(json.dumps({'selected_model':selected,'test_macro_f1':test['macro_f1'],
  'critical_recall':test['classification_report']['Critical']['recall'],'artifacts':str(out)},indent=2))

if __name__=='__main__':main()
