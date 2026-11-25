"""Read-only readiness check for a site-authored procedure. Never grants approval or imports it."""
import argparse,datetime as dt,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api_server.sop_governance import approval_review
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('procedure',type=Path);args=parser.parse_args()
    doc=json.loads(args.procedure.read_text(encoding='utf-8-sig'))
    result=approval_review(doc,dt.datetime.now(dt.timezone.utc))
    print(json.dumps(result,indent=2))
    print('Metadata checks only; qualified site approval and applicable equipment instructions are still required.')
    return 0 if result['usable_approved'] else 1
if __name__=='__main__':raise SystemExit(main())
