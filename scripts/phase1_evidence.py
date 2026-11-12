"""Read-only, source-derived Phase 1 evidence. Never prints credentials."""
from pathlib import Path
import hashlib,json,os
import pandas as pd
import numpy as np

ROOT=Path(__file__).resolve().parents[1]

def research_sources(base=None):
    base=Path(base or os.environ.get('FACTORYPULSE_DATASET_ROOT','C:/Downloads/datasets oct 5'))
    groups={
        'tool_wear':list((base/'1').rglob('Dataset_Machine_tool_wear.csv')),
        'turning_roughness':[base/'2/cnc turning roughness'/f'Exp{i}.csv' for i in (1,2)],
        'mill_telemetry':sorted((base/'3/cnc mill tool wear').glob('experiment_*.csv')),
        'milling_life':[base/'FeatureAndMetadata_Milling/FeatureAndMetadata_Milling.csv'],
    }
    frames={};manifest=[]
    for name,paths in groups.items():
        chunks=[]
        for path in paths:
            if not path.is_file():continue
            # This source has an extra generic Column1... line above its real header.
            frame=pd.read_csv(path,sep=';' if name=='milling_life' else ',',header=1 if name=='milling_life' else 0,decimal=',' if name=='milling_life' else '.',na_values=['na','NA','NaN','?'])
            frame.columns=frame.columns.str.strip()
            manifest.append({'dataset':name,'file':path.name,'rows':len(frame),'columns':len(frame.columns),
                             'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
            frame['_source_file']=path.name
            chunks.append(frame)
        if chunks:frames[name]=pd.concat(chunks,ignore_index=True)
    return frames,pd.DataFrame(manifest)

def quality_summary(frames):
    rows=[]
    for name,frame in frames.items():
        values=frame.drop(columns=['_source_file'])
        rows.append({'dataset':name,'rows':len(frame),'columns':len(values.columns),
            'source_files':frame['_source_file'].nunique(),'missing_cells':int(values.isna().sum().sum()),
            'duplicate_value_rows':int(values.duplicated().sum())})
    return pd.DataFrame(rows)

def numeric_summary(frame,columns):
    rows=[]
    for name in columns:
        if name not in frame:continue
        source=frame[name];numeric=pd.to_numeric(source,errors='coerce').replace([np.inf,-np.inf],np.nan)
        good=numeric.dropna()
        rows.append({'column':name,'count':len(good),'missing_or_invalid':int(numeric.isna().sum()),
            'min':good.min(),'mean':good.mean(),'median':good.median(),'std_sample':good.std(ddof=1),
            'p25':good.quantile(.25),'p75':good.quantile(.75),'p95':good.quantile(.95),'max':good.max()})
    return pd.DataFrame(rows)

def mysql_snapshot():
    from api_server import main as api
    engine=api.get_telemetry_engine()
    # One consistent database transaction; reads only. No personnel or passwords.
    with engine.connect() as c:
        with c.begin():
            rows=pd.read_sql(api._sql_text('''SELECT reading_id,machine_id,machine_code,reading_timestamp,
              sensor_name,sensor_unit,sensor_value_json,data_quality,machine_status,expected_min,expected_max,data_source,data_provenance
              FROM v_factorypulse_latest_readings ORDER BY machine_id,sensor_name'''),c)
            raw=[]
            for table in ('raw_cnc_tool_wear','raw_turning_roughness','raw_mill_telemetry','raw_milling_cycles'):
                exists=c.execute(api._sql_text('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=:table'),{'table':table}).scalar()
                raw.append({'table':table,'rows':int(c.execute(api._sql_text(f'SELECT COUNT(*) FROM `{table}`')).scalar()) if exists else None,'present':bool(exists)})
    def number(value):
        try:
            parsed=json.loads(value) if isinstance(value,str) else value
            return float(parsed) if not isinstance(parsed,bool) and parsed is not None and np.isfinite(float(parsed)) else np.nan
        except (TypeError,ValueError):return np.nan
    rows['numeric_value']=rows['sensor_value_json'].map(number)
    rows['valid_numeric']=rows['data_quality'].eq('GOOD') & rows['numeric_value'].notna()
    return rows,pd.DataFrame(raw)

def live_statistics(rows):
    good=rows.loc[rows.valid_numeric]
    # Keep name AND unit as grouping keys; never average mixed measurements.
    result=good.groupby(['sensor_name','sensor_unit']).numeric_value.agg(['count','mean','median','min','max','std']).reset_index()
    return result

def reconciliation(rows):
    keys=['reading_id','machine_id','sensor_name','sensor_unit','sensor_value_json','data_quality']
    records=rows[keys].sort_values('reading_id').to_dict('records')
    return {'rows':len(rows),'machines':int(rows.machine_id.nunique()),
        'duplicate_machine_sensor_keys':int(rows.duplicated(['machine_id','sensor_name']).sum()),
        'missing_reading_ids':int(rows.reading_id.isna().sum()),
        'snapshot_sha256':hashlib.sha256(json.dumps(records,sort_keys=True,default=str).encode()).hexdigest()}
