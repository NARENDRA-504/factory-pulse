"""Inspect actual CSV inputs; historical filename retained. Does not import to MySQL."""
import datetime as dt,json
from pathlib import Path
try:
    from scripts.phase1_evidence import research_sources, quality_summary, numeric_summary
except ModuleNotFoundError:
    from phase1_evidence import research_sources, quality_summary, numeric_summary

def run_validation_pipeline(base=None):
    frames,manifest=research_sources(base)
    required={'tool_wear':'Vb','turning_roughness':'Ra','mill_telemetry':'S1_ActualVelocity','milling_life':'CycleToFailure'}
    checks={name:name in frames and target in frames[name] and len(frames[name])>0 for name,target in required.items()}
    return {'checked_at_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
        'source_files_read':len(manifest),'audit_passed':all(checks.values()),
        'meaning_of_pass':'All four input groups are present, nonempty and contain required targets; not a clean-data or database-import claim.',
        'required_columns_present':checks,'datasets_verified':quality_summary(frames).to_dict('records') if frames else [],
        'source_manifest':manifest.to_dict('records'),
        'target_statistics':{name:numeric_summary(frames[name],[target]).to_dict('records') for name,target in required.items() if checks[name]},
        'database_writes':False,'rows_dropped':0,'values_imputed':0,
        'limitations':['Missing values and duplicate-valued rows retained.',
            'Vb source unit is unverified; no automatic mm label.',
            'CycleToFailureNormalized must not predict CycleToFailure.',
            'MySQL research ingestion is checked separately in the notebook.']}

if __name__=='__main__':
    result=run_validation_pipeline()
    Path(__file__).with_name('validation_summary.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
    print(json.dumps({k:result[k] for k in ('source_files_read','audit_passed','datasets_verified','database_writes')}))
    raise SystemExit(0 if result['audit_passed'] else 1)
