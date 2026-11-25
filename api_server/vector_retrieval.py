"""Local, optional embeddings of curated guidance only. Never indexes operational data."""
import hashlib
import json
import threading
from functools import lru_cache
from pathlib import Path

MODEL = 'BAAI/bge-small-en-v1.5'
DIMENSIONS = 384
INDEX_DIR = Path(__file__).resolve().parents[1] / '.local' / 'rag-vectors'
_lock = threading.Lock()


def fingerprint(chunks):
    return hashlib.sha256(json.dumps([(c['id'], c['title'], c['passage_sha256']) for c in chunks],
                                    ensure_ascii=False).encode()).hexdigest()


@lru_cache(maxsize=1)
def _model(cache_dir):
    from fastembed import TextEmbedding
    # Models are downloaded by the explicit preparation command, never by a question.
    return TextEmbedding(MODEL, cache_dir=cache_dir, threads=2, local_files_only=True)


@lru_cache(maxsize=2)
def _index(directory, corpus_hash, modified):
    import numpy as np
    folder = Path(directory)
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    if (manifest.get('corpus_sha256') != corpus_hash or manifest.get('model') != MODEL
            or manifest.get('dimensions') != DIMENSIONS):
        raise ValueError('Index needs rebuilding')
    digest = hashlib.sha256((folder / 'vectors.npz').read_bytes()).hexdigest()
    if manifest.get('vectors_sha256') != digest:
        raise ValueError('Index integrity check failed')
    with np.load(folder / 'vectors.npz', allow_pickle=False) as archive:
        vectors = archive['vectors'].copy()
    if (vectors.shape != (len(manifest['ids']), DIMENSIONS) or not np.isfinite(vectors).all()
            or not np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=.001)):
        raise ValueError('Invalid vectors')
    return manifest['ids'], vectors


def semantic_search(question, chunks):
    """Return cosine scores and truthful availability; errors preserve lexical retrieval."""
    unavailable = {'status': 'unavailable', 'reason': 'Local vector index unavailable or needs rebuilding'}
    if not chunks or not (INDEX_DIR / 'manifest.json').is_file():
        return {}, unavailable
    try:
        import numpy as np
        with _lock:
            ids, vectors = _index(str(INDEX_DIR), fingerprint(chunks),
                                  ((INDEX_DIR / 'manifest.json').stat().st_mtime_ns,
                                   (INDEX_DIR / 'vectors.npz').stat().st_mtime_ns))
            if ids != [c['id'] for c in chunks]:
                raise ValueError('Corpus IDs differ')
            model = _model(str(INDEX_DIR / 'models'))
            query = np.asarray(next(iter(model.query_embed(question[:2000]))), dtype=np.float32)
            if query.shape != (DIMENSIONS,) or not np.isfinite(query).all() or np.linalg.norm(query) == 0:
                raise ValueError('Invalid query vector')
            scores = vectors @ (query / np.linalg.norm(query))
        return dict(zip(ids, map(float, scores))), {
            'status': 'ready', 'model': MODEL, 'dimensions': DIMENSIONS,
            'scope': 'Curated guidance only; machine facts remain authorized SQL records'}
    except Exception:
        # Do not return exception strings: paths/provider details are not user evidence.
        return {}, unavailable
