"""Separate localhost practice API. Does not access FactoryPulse or databases."""
from functools import lru_cache
from pathlib import Path
from typing import Literal
import hashlib,json,math
import joblib,pandas as pd
from fastapi import FastAPI,HTTPException
from pydantic import BaseModel,ConfigDict,field_validator

ROOT=Path(__file__).resolve().parent
app=FastAPI(title='Machine Health Practice API',description='Synthetic learning exercise; not connected to operational alerts.')

class Reading(BaseModel):
 model_config=ConfigDict(extra='forbid',strict=True)
 temperature_c:float
 vibration:float
 spindle_rpm:float
 motor_current_a:float
 motor_load_pct:float
 pressure_bar:float
 coolant_flow_l_min:float
 ambient_temperature_c:float
 hours_since_service:float
 machine_type:Literal['Milling','Turning','Grinding','Drilling']

 @field_validator('*')
 @classmethod
 def finite(cls,value):
  if isinstance(value,float) and not math.isfinite(value):raise ValueError('A finite measurement is required')
  return value

@lru_cache(maxsize=1)
def load():
 path=ROOT/'artifacts/model.joblib';report=ROOT/'artifacts/evaluation.json'
 if not path.exists() or not report.exists():raise HTTPException(503,'Run train.py first')
 info=json.loads(report.read_text(encoding='utf-8'))
 if hashlib.sha256(path.read_bytes()).hexdigest()!=info['sha256']:raise HTTPException(503,'Model checksum mismatch; retrain')
 # Only load the trusted locally trained artifact. Never accept uploaded joblib files.
 return joblib.load(path),info

@app.get('/health')
def health():
 _,info=load()
 return {'status':'ready','mode':'practice_only','model':info['selected_model'],'automatic_alerts':False}

@app.post('/predict')
def predict(reading:Reading):
 bundle,info=load();frame=pd.DataFrame([reading.model_dump()])[bundle['features']]
 model=bundle['pipeline'];label=str(model.predict(frame)[0]);p=model.predict_proba(frame)[0]
 return {'prediction':label,'model_scores':{str(k):float(v) for k,v in zip(model.classes_,p)},
  'model':info['selected_model'],'meaning':'Normal: no modeled failure within 120min; Suspect: 30–120min; Critical: 0–30min.',
  'notice':'Fictional practice data; scores are uncalibrated. Not a real-time safety decision or operational alert.'}
