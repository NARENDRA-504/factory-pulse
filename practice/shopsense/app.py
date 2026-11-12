"""Local inference deployment. Load only the artifact created by train.py."""
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal
import json
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel,ConfigDict,Field

ROOT=Path(__file__).resolve().parent
class SessionInput(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    Administrative:int=Field(ge=0,le=10000,description='Administrative pages visited')
    Administrative_Duration:float=Field(ge=0,le=86400,description='Seconds on administrative pages')
    Informational:int=Field(ge=0,le=10000,description='Information pages visited')
    Informational_Duration:float=Field(ge=0,le=86400,description='Seconds on information pages')
    ProductRelated:int=Field(ge=0,le=10000,description='Product pages visited')
    ProductRelated_Duration:float=Field(ge=0,le=86400,description='Seconds on product pages')
    Month:Literal['Jan','Feb','Mar','Apr','May','June','Jul','Aug','Sep','Oct','Nov','Dec']
    VisitorType:Literal['Returning_Visitor','New_Visitor','Other']
    Weekend:bool

@asynccontextmanager
async def lifespan(app):
    path=ROOT/'artifacts/model.joblib'
    if not path.is_file():raise RuntimeError('Run python train.py first to create model.joblib.')
    app.state.bundle=joblib.load(path)
    yield

app=FastAPI(title='ShopSense purchase prediction',version='1.0',lifespan=lifespan,
    description='Educational e-commerce session classifier trained on real UCI data. Use POST /predict to test your trained model. Historical offline evaluation does not establish live shopping performance.')
@app.get('/',include_in_schema=False)
def home():return RedirectResponse('/docs')
@app.get('/health')
def health():return {'status':'ok','model_version':app.state.bundle['version']}
@app.get('/metrics')
def metrics():return json.loads((ROOT/'artifacts/metrics.json').read_text(encoding='utf-8'))
@app.get('/example')
def example():return json.loads((ROOT/'example_request.json').read_text(encoding='utf-8'))
@app.post('/predict')
def predict(session:SessionInput):
    row=session.model_dump()
    for count,duration in [('Administrative','Administrative_Duration'),('Informational','Informational_Duration'),('ProductRelated','ProductRelated_Duration')]:
        if row[count]==0 and row[duration]>0:raise HTTPException(422,f'{duration} must be zero when {count} is zero.')
    bundle=app.state.bundle
    score=float(bundle['pipeline'].predict_proba(pd.DataFrame([row],columns=bundle['features']))[0,1])
    return {'purchase_score':score,'predicted_purchase':score>=bundle['threshold'],
        'threshold':bundle['threshold'],'model_version':bundle['version'],
        'meaning':'Historical-model score; not a guaranteed purchase or verified live conversion probability.'}
