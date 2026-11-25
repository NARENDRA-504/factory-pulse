"""Explicitly download public embedding weights and index only approved guidance."""
import json
import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api_server.rag import knowledge_chunks
from api_server.vector_retrieval import MODEL, DIMENSIONS, INDEX_DIR, fingerprint


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true',help='Use cached embedding weights only; never download')
    args=parser.parse_args()
    import numpy as np
    from fastembed import TextEmbedding
    chunks = knowledge_chunks()
    if not chunks:
        raise SystemExit('No approved guidance found')
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    model = TextEmbedding(MODEL, cache_dir=str(INDEX_DIR / 'models'), threads=2, local_files_only=args.offline)
    vectors = np.asarray(list(model.passage_embed([c['title'] + '\n' + c['excerpt'] for c in chunks])), dtype=np.float32)
    if vectors.shape != (len(chunks), DIMENSIONS) or not np.isfinite(vectors).all():
        raise SystemExit('Embedding validation failed')
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    if (norms == 0).any():
        raise SystemExit('Empty vector')
    np.savez_compressed(INDEX_DIR / 'vectors.npz', vectors=vectors / norms)
    manifest = {'model': MODEL, 'dimensions': DIMENSIONS, 'corpus_sha256': fingerprint(chunks),
                'ids': [c['id'] for c in chunks],
                'vectors_sha256': hashlib.sha256((INDEX_DIR / 'vectors.npz').read_bytes()).hexdigest()}
    temporary = INDEX_DIR / 'manifest.tmp'
    temporary.write_text(json.dumps(manifest), encoding='utf-8')
    temporary.replace(INDEX_DIR / 'manifest.json')
    print(f'Prepared {len(chunks)} curated passages; {DIMENSIONS} dimensions; local CPU model.')


if __name__ == '__main__':
    main()
