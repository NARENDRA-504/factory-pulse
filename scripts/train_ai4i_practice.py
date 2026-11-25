"""Separate UCI benchmark: never replaces FactoryPulse's operational model."""
import argparse, hashlib, io, json, urllib.request, zipfile
from pathlib import Path

URL = 'https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip'
ROOT = Path(__file__).resolve().parents[1]
FEATURES = ['Type', 'Air temperature [K]', 'Process temperature [K]',
            'Rotational speed [rpm]', 'Torque [Nm]', 'Tool wear [min]']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    folder = ROOT / '.local/ai4i-practice'
    folder.mkdir(parents=True, exist_ok=True)
    source = folder / 'ai4i2020.csv'
    if args.download and not source.exists():
        with urllib.request.urlopen(URL, timeout=45) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('Download exceeds expected small dataset bound')
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            member = next(x for x in archive.infolist() if Path(x.filename).name == 'ai4i2020.csv')
            if member.file_size > 2_000_000:
                raise ValueError('CSV exceeds size bound')
            source.write_bytes(archive.read(member))
    import pandas as pd
    import numpy as np
    import sklearn
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.pipeline import make_pipeline
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score, average_precision_score
    import joblib
    df = pd.read_csv(source)
    if len(df) != 10000 or df['UDI'].duplicated().any() or df[FEATURES + ['Machine failure']].isna().any().any():
        raise ValueError('Unexpected rows, duplicate IDs or missing training fields')
    if not set(df['Machine failure']).issubset({0, 1}):
        raise ValueError('Invalid binary labels')
    for column in FEATURES[1:]:
        if not np.isfinite(df[column]).all():
            raise ValueError('Nonfinite sensor values')
    # Ordered holdout, with unused boundary rows. UDI is row order, NOT a timestamp.
    train, validation, test = df.iloc[:6000], df.iloc[6100:8000], df.iloc[8100:]
    model = make_pipeline(ColumnTransformer([
        ('type', OneHotEncoder(handle_unknown='ignore'), ['Type']),
        ('numeric', 'passthrough', FEATURES[1:])]),
        RandomForestClassifier(n_estimators=160, min_samples_leaf=2, class_weight='balanced', random_state=42, n_jobs=2))
    model.fit(train[FEATURES], train['Machine failure'])
    def evaluate(part, threshold):
        y = part['Machine failure']; probability = model.predict_proba(part[FEATURES])[:, 1]
        predicted = probability >= threshold
        return dict(rows=len(part), failures=int(y.sum()), confusion_matrix=confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
                    precision=float(precision_score(y, predicted, zero_division=0)), recall=float(recall_score(y, predicted, zero_division=0)),
                    f1=float(f1_score(y, predicted, zero_division=0)), average_precision=float(average_precision_score(y, probability)))
    choices = [(evaluate(validation, float(t))['f1'], float(t)) for t in np.arange(.1, .81, .05)]
    threshold = max(choices)[1]  # Select once on validation; never on test.
    artifact = folder / 'practice-model.joblib'
    joblib.dump({'model': model, 'threshold': threshold, 'features': FEATURES}, artifact)
    report = dict(source_url=URL, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  source_kind='UCI synthetic benchmark; not independent real-machine validation',
                  target='Machine failure on this row; NOT future failure prediction or Normal/Suspect/Critical',
                  split='UDI ordered 6000 train / 1900 validation / 1900 test, two 100-row gaps; no verified time horizon',
                  excluded_features=['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF'],
                  threshold=threshold, validation=evaluate(validation, threshold), test=evaluate(test, threshold),
                  majority_test_accuracy=float((test['Machine failure'] == 0).mean()), sklearn_version=sklearn.__version__,
                  model_sha256=hashlib.sha256(artifact.read_bytes()).hexdigest(), operational_deployment=False,
                  limits=['Synthetic rule-based failures', 'No independent equipment identities or timestamps',
                          'No pressure, vibration, coolant-flow or current channels', 'No calibration or site safety approval'])
    (folder / 'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
