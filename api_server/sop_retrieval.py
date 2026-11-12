"""Bounded role/applicability retrieval. Never authorizes equipment operation."""
import datetime as dt
import hashlib
import json
import math
import re
from pathlib import Path

CATALOG = Path(__file__).resolve().parents[1] / 'knowledge/sop/catalog.json'

def retrieve_sop(question, role, machine_id=None, facts=(), now=None):
    role = 'Admin' if role == 'Super Admin' else role
    now = now or dt.datetime.now(dt.timezone.utc)
    eligible=[]; issues=[]
    try:
        content=CATALOG.read_bytes()
        if len(content)>200000: raise ValueError('catalog too large')
        documents=json.loads(content)['documents']
        if not isinstance(documents,list): raise ValueError('invalid catalog')
    except (OSError,ValueError,KeyError,TypeError):
        return {'status':'unavailable','notice':'SOP catalog unavailable. Contact your supervisor for the approved procedure.', 'sources':[], 'machine_id':machine_id}
    query=set(re.findall(r'[a-z]+',question.lower()))
    for doc in documents[:100]:
        try:
            if doc['status'] not in {'training','approved'}: continue
            steps=doc['roles'].get(role)
            if not steps or not isinstance(steps,list) or not all(isinstance(s,str) and 0<len(s)<=700 for s in steps): continue
            # Approved operational instructions require an explicit machine mapping and approval metadata.
            if doc['status']=='approved':
                if not machine_id or machine_id not in doc.get('machine_ids',[]): continue
                if not doc.get('approved_by') or not doc.get('manual_reference'): continue
                effective=dt.date.fromisoformat(doc['effective_date'])
                expires=dt.date.fromisoformat(doc['review_due'])
                if not effective<=now.date()<=expires: continue
            elif doc.get('machine_ids') and machine_id not in doc['machine_ids']: continue
            score=len(query & set(doc['keywords']))
            if score or doc['category']=='general': eligible.append((doc,score))
        except (KeyError,TypeError,ValueError):
            issues.append('invalid_document')
    # Words such as "SOP" must not cause a generic document to beat a sensor match.
    specific=[pair for pair in eligible if pair[0]['category']!='general' and pair[1]>0]
    if specific:eligible=specific
    eligible.sort(key=lambda pair:(-pair[1],pair[0]['status']!='approved',pair[0]['id']))
    chosen=eligible[:1]
    sources=[]
    for doc,_ in chosen:
        excerpt=('Approval: '+doc['status']+'. '+doc['scope_notice']+'\n'+
                 '\n'.join(f'{i+1}. {step}' for i,step in enumerate(doc['roles'][role][:8])))
        sources.append({'id':'SOP-'+doc['id'],'kind':'sop','title':doc['title'],
            'document_id':doc['id'],'revision':doc['revision'],'approval_status':doc['status'],
            'approved_by':doc.get('approved_by'),'manual_reference':doc.get('manual_reference'),
            'effective_date':doc.get('effective_date'),'review_due':doc.get('review_due'),
            'source':'knowledge/sop/catalog.json#'+doc['id'],'section':role+' response',
            'excerpt':excerpt,'steps':doc['roles'][role][:8],
            'sha256':hashlib.sha256(json.dumps(doc,sort_keys=True).encode()).hexdigest()})
    fresh=[]
    for fact in facts:
        if fact.get('machine_id')!=machine_id or fact.get('data_quality')!='GOOD': continue
        try:
            stamp=dt.datetime.fromisoformat(str(fact['timestamp']).replace('Z','+00:00'))
            if stamp.tzinfo is None:stamp=stamp.replace(tzinfo=dt.timezone.utc)
            age=(now-stamp).total_seconds()
            value=fact.get('sensor_value')
            if not 0<=age<=30 or isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):continue
            fresh.append(fact)
        except (ValueError,KeyError,TypeError):continue
    level='Unavailable'
    if fresh:
        states={r.get('machine_status') for r in fresh}
        level='Critical' if 'CRITICAL' in states else 'Suspect' if 'WARNING' in states else 'Normal' if states=={'NORMAL'} else 'Other'
    status='approved' if sources and sources[0]['approval_status']=='approved' else 'training_only' if sources else 'missing'
    return {'status':status,'machine_id':machine_id,'level':level,
        'detection_source':'Latest received GOOD sensor status within 30 seconds; not an ML diagnosis or failure forecast.',
        'notice':('Approved procedure retrieved; follow its equipment/site authorization requirements.' if status=='approved' else
                  'No approved machine-specific SOP was retrieved. Training guidance only; contact your supervisor for the approved procedure.'),
        'sources':sources,'evidence':[{'reading_id':r.get('reading_id'),'sensor_name':r.get('sensor_name'),
            'sensor_value':r.get('sensor_value'),'sensor_unit':r.get('sensor_unit'),'timestamp':r.get('timestamp')} for r in fresh[:8]],
        'catalog_issues':len(issues),'notifications_sent':False}
