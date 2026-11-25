"""Administrator review of existing guidance and verified local model artifacts."""
import json
import math
from fastapi import Depends,HTTPException
from . import sop_retrieval
from .sop_governance import approval_review
from .health_model import model_status
from pathlib import Path
from .reference_library import public_references

ROOT=Path(__file__).resolve().parents[1]

def practice_benchmark():
    """Public metrics only; independent of the operational release gate."""
    path=ROOT/'.local/ai4i-practice/evaluation.json'
    try:
        if path.stat().st_size>20000:raise ValueError()
        data=json.loads(path.read_text(encoding='utf-8'))
        test=data['test'];matrix=test['confusion_matrix']
        if len(matrix)!=2 or any(len(row)!=2 for row in matrix):raise ValueError()
        if any(type(n) is not int or n<0 for row in matrix for n in row):raise ValueError()
        if sum(map(sum,matrix))!=test['rows']:raise ValueError()
        metrics={k:test[k] for k in ('precision','recall','f1')}
        if any(type(v) not in (int,float) or not math.isfinite(v) or not 0<=v<=1 for v in metrics.values()):raise ValueError()
        return {'available':True,'name':'UCI AI4I practice benchmark','rows':test['rows'],
                'detected':matrix[1][1],'missed':matrix[1][0],'false_alarms':matrix[0][1],**metrics,
                'operational_deployment':False,
                'notice':'Separate synthetic current-row failure classifier. Not the deployed seven-sensor model, future-failure validation or site approval.'}
    except (OSError,ValueError,KeyError,TypeError,IndexError):return {'available':False}
def completion_evidence(status):
    recovery={'available':False,'notice':'No completed recovery evidence is available.'}
    reports=sorted((ROOT/'.local/recovery').glob('factorypulse-restore-*.json'),key=lambda p:p.stat().st_mtime,reverse=True)
    for path in reports:
        if path.name.endswith('.acceptance.json'):continue
        try:
            if path.stat().st_size>200000:continue
            data=json.loads(path.read_text(encoding='utf-8-sig'))
            recovery={'available':True,**{key:data.get(key) is True for key in ('dump_restore_verified','data_restore_verified','application_workflow_verified','source_row_parity_verified','latest_reading_parity_verified')},
                'notice':'Recorded isolated restore evidence. This does not prove a fresh backup, hosted deployment or every browser flow.'}
            break
        except (OSError,ValueError,TypeError):continue
    validation={'available':False}
    path=ROOT/'.local/health-model-v2/validation-audit.json'
    try:
        if path.stat().st_size<=200000:
            data=json.loads(path.read_text())
            if data.get('model_sha256')==status.get('model_sha256') and data.get('model_sha256'):
                validation={'available':True,**{key:data.get(key) for key in ('checked_at_utc','deployed_inference_matches','test_samples','critical_recall_95pct_interval','critical_precision_95pct_interval','limitations')}}
    except (OSError,ValueError,TypeError):pass
    return {'recovery':recovery,'validation_audit':validation,'practice_benchmark':practice_benchmark(),
            'reference_library':public_references()}

def model_review(status):
    test=status.get('test') or {};matrix=test.get('confusion_matrix');order=test.get('matrix_order')
    result={'status':status.get('status','unavailable'),'model':status.get('model','Unavailable'),
        'training_source':status.get('training_source','Not recorded'),'trained_at_utc':status.get('trained_at_utc'),
        'alerts_enabled':False,'real_machine_validation':(status.get('release_gate') or {}).get('real_machine_validation') is True,
        'metrics_available':False,'release_ready':False,
        'notice':'Read-only validation evidence. Synthetic test results do not establish real-machine reliability. This page cannot enable automatic model alerts.'}
    if status.get('status')=='unavailable':return result
    try:
        if not isinstance(order,list) or len(order)!=3 or set(order)!={'Normal','Suspect','Critical'}:raise ValueError()
        if not isinstance(matrix,list) or len(matrix)!=3:raise ValueError()
        if any(not isinstance(row,list) or len(row)!=3 or any(isinstance(n,bool) or not isinstance(n,int) or n<0 for n in row) for row in matrix):raise ValueError()
        total=sum(map(sum,matrix))
        if not total or test.get('rows')!=total:raise ValueError()
        ci=order.index('Critical');ni=order.index('Normal');tp=matrix[ci][ci];actual=sum(matrix[ci]);predicted=sum(row[ci] for row in matrix)
        recall=tp/actual if actual else None;precision=tp/predicted if predicted else None
        result.update(metrics_available=True,test_rows=total,critical_detected=tp,critical_missed=actual-tp,
            false_critical=predicted-tp,normal_samples_flagged=sum(matrix[ni])-matrix[ni][ni],
            critical_recall=recall,critical_precision=precision,accuracy=sum(matrix[i][i] for i in range(3))/total,
            confusion_matrix=matrix,matrix_order=order,
            gates=[{'label':'Representative real-machine validation','passed':result['real_machine_validation']},
                   {'label':'Critical recall at least 90%','passed':recall is not None and recall>=.90},
                   {'label':'Critical precision at least 80%','passed':precision is not None and precision>=.80}])
        result['release_ready']=all(g['passed'] for g in result['gates'])
    except (ValueError,TypeError,KeyError,IndexError):
        result['notice']='A consistent labeled confusion matrix is unavailable. No missed-fault or false-alarm counts are inferred.'
    return result

def register(app,api):
    @app.get('/api/v1/admin/readiness-review')
    def review(user=Depends(api['require_roles'](['Admin']))):
        now=api['_utcnow']()
        try:
            raw=sop_retrieval.CATALOG.read_bytes()
            if len(raw)>200000:raise ValueError()
            documents=json.loads(raw)['documents']
            if not isinstance(documents,list) or any(not isinstance(d,dict) for d in documents):raise ValueError()
        except (OSError,ValueError,KeyError,TypeError):raise HTTPException(503,'SOP review catalog is unavailable') from None
        rows=[]
        for doc in documents[:100]:
            rows.append({'document_id':doc.get('id'),'title':doc.get('title'),'revision':doc.get('revision'),
                'status':doc.get('status'),'approved_by':doc.get('approved_by'),'manual_reference':doc.get('manual_reference'),
                'effective_date':doc.get('effective_date'),'review_due':doc.get('review_due'),
                'machine_count':len(doc.get('machine_ids',[])) if isinstance(doc.get('machine_ids'),list) else 0,
                **approval_review(doc,now)})
        status=model_status()
        return {'checked_at':now.isoformat(),**completion_evidence(status),'sop':{'documents':rows,'limit_reached':len(documents)>100,
                'usable_approved':sum(d['usable_approved'] for d in rows),'overdue':sum(d['review_overdue'] for d in rows),
                'notice':'Metadata review only. Training drafts remain drafts. A competent site owner must supply and approve applicable equipment procedures; no approval is created here.'},
                'model':model_review(status)}
