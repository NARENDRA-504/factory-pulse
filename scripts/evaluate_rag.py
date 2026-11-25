"""Read-only local retrieval regression; no API, credentials or database required."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api_server.rag import retrieve_context

CASES = [
    ('shift production target', 'Shift production'),
    ('good scrap counters quality', 'Production calculations'),
    ('old sensor timestamp freshness', 'Thresholds and freshness'),
    ('incident technician resolved', 'Incident and maintenance workflow'),
    ('electricity shaft energy cost', 'Costs and energy'),
    ('supervisor access source', 'Access and data sources'),
]

def main():
    checks=[]
    for question, expected in CASES:
        result=retrieve_context(question, [])
        titles=[s['title'] for s in result['sources']]
        checks.append({'question':question, 'expected_title':expected,
                       'retrieved_titles':titles, 'passed':expected in titles,
                       'vector_status':result['vector_search']['status']})
    empty=retrieve_context('xyzzy123', [])
    checks.append({'question':'xyzzy123', 'passed':empty['evidence_status']=='no_evidence'})
    report={'scope':'Small curated regression, not a general accuracy benchmark',
            'passed':sum(c['passed'] for c in checks), 'total':len(checks), 'checks':checks}
    folder=ROOT/'.local'; folder.mkdir(exist_ok=True)
    (folder/'advanced-rag-evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
    if report['passed']!=report['total']:raise SystemExit(1)

if __name__=='__main__':main()
