"""Bounded local hybrid retrieval over approved guidance and authorized SQL facts.

No arbitrary workspace files, credentials, personnel records or external index are read.
Authorization of SQL facts must happen before calling retrieve_context.
"""
import hashlib
import datetime as dt
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from .chat_scope import FOLLOWUP, in_scope
from .sop_evidence import SENSORS
from .vector_retrieval import semantic_search

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / 'knowledge' / 'assistant'
APPROVED_FILES = ('production.md', 'readings.md', 'workflows.md', 'sop.md', 'diagnostics.md', 'public-references.md')
STOP = frozenset('a an the is are of for to in and or my me what how please tell about this that its it with show latest current machine machines'.split())


def requested_sensors(question):
    """Longest phrases first so motor temperature does not select case temperature."""
    text = str(question).lower()
    found = set()
    phrases = [('motor temperature', 'Motor Temperature'), ('coolant flow', 'Coolant Flow'),
               ('motor load', 'Motor Load'), ('motor power', 'Motor Power'),
               ('current draw', 'Current'), ('spindle speed', 'RPM'),
               ('rpm', 'RPM'), ('vibration', 'Vibration'), ('temperature', 'Temperature'),
               ('pressure', 'Pressure'), ('voltage', 'Voltage'), ('torque', 'Torque')]
    for phrase, sensor in phrases:
        pattern = r'\b' + re.escape(phrase) + r'\b'
        if re.search(pattern, text):
            found.add(sensor)
            text = re.sub(pattern, ' ', text)
    return found


def tokens(text):
    words = re.findall(r'[a-z0-9]+', str(text).lower())
    aliases = {'parts': 'part', 'readings': 'reading', 'temperatures': 'temperature',
               'alarms': 'incident', 'alarm': 'incident', 'fault': 'incident',
               'downtimes': 'downtime', 'shifts': 'shift', 'repair': 'maintenance'}
    return [aliases.get(word, word) for word in words if word not in STOP]


def resolve_retrieval_question(question, prior_questions=()):
    """Use a single recent question only for an explicitly referential follow-up.

    The caller must first remove questions about other selected machines.
    Conversation history is context, never an authority or a permission grant.
    """
    if FOLLOWUP.fullmatch(question.strip()):
        for previous in reversed(list(prior_questions)[-4:]):
            if in_scope(previous) and not FOLLOWUP.fullmatch(previous.strip()):
                return previous[:1000] + '\nFollow-up: ' + question[:1000]
    return question[:1000]


def _passages(body, size=900, overlap=120):
    """Bounded windows retain the tail of long sections rather than truncating it."""
    body = body.strip()
    start = 0
    while start < len(body):
        end = min(start + size, len(body))
        if end < len(body):
            boundary = body.rfind(' ', start + size // 2, end)
            if boundary > start:
                end = boundary
        yield body[start:end]
        if end == len(body):
            break
        start = max(start + 1, end - overlap)


@lru_cache(maxsize=8)
def _chunks(snapshot):
    chunks = []
    for name, content in snapshot:
        sections = re.split(r'(?m)^#{1,3} ', content)
        for index, section in enumerate(sections[1:], 1):
            title, _, body = section.partition('\n')
            for part, excerpt in enumerate(_passages(body), 1):
                identifier = f'K-{name[:-3]}-{index}' + (f'-p{part}' if part > 1 else '')
                chunks.append({'id': identifier, 'kind': 'project_knowledge',
                               'title': title.strip(), 'section': title.strip(), 'passage': part,
                               'source': f'knowledge/assistant/{name}', 'excerpt': excerpt,
                               'sha256': hashlib.sha256(content.encode()).hexdigest(),
                               'passage_sha256': hashlib.sha256(excerpt.encode()).hexdigest()})
    return chunks


def knowledge_chunks():
    snapshot = []
    for name in APPROVED_FILES:
        path = KNOWLEDGE_DIR / name
        if (path.is_file() and path.resolve().parent == KNOWLEDGE_DIR.resolve()
                and path.stat().st_size <= 32000):
            snapshot.append((name, path.read_text(encoding='utf-8')))
    return _chunks(tuple(snapshot))


def retrieve_context(question, facts, machine_id=None, now=None, stale_seconds=30):
    chunks = knowledge_chunks()
    query = set(tokens(question))
    # Explicit lexical aliases, not an embedding model or a generated query.
    expansions = {'heat': {'temperature'}, 'hot': {'temperature'}, 'overheating': {'temperature'},
                  'speed': {'rpm', 'spindle'}, 'reject': {'scrap'}, 'rejected': {'scrap'},
                  'electricity': {'energy', 'power'}, 'repair': {'maintenance'}}
    for word in list(query):
        query.update(expansions.get(word, set()))
    docs = [tokens(chunk['title'] + ' ' + chunk['excerpt']) for chunk in chunks]
    average = sum(map(len, docs)) / max(1, len(docs))
    ranked = []
    for chunk, words in zip(chunks, docs):
        frequencies = Counter(words)
        score = 0.0
        for word in query:
            frequency = frequencies[word]
            if not frequency:
                continue
            containing = sum(word in doc for doc in docs)
            idf = math.log(1 + (len(docs) - containing + .5) / (containing + .5))
            score += idf * frequency * 2.2 / (frequency + 1.2 * (.25 + .75 * len(words) / max(1, average)))
        title_matches = query & set(tokens(chunk['title']))
        if score > 0:
            # Heading matches and query coverage rerank BM25 candidates.
            matched = query & set(words)
            score += 1.5 * len(title_matches) + len(matched) / max(1, len(query))
            ranked.append((score, {**chunk, 'relevance_score': round(score, 4),
                                   'matched_terms': sorted(matched)}))
    semantic, vector_status = semantic_search(question, chunks)
    if semantic:
        # Reciprocal rank fusion preserves exact-term search and adds semantic matches.
        lexical = sorted(ranked, key=lambda item: (-item[0], item[1]['id']))
        candidates = {chunk['id']: dict(chunk) for _, chunk in lexical}
        fusion = {chunk['id']: 1 / (60 + rank) for rank, (_, chunk) in enumerate(lexical, 1)}
        vector_ranked = sorted(((semantic.get(c['id'], -1), c) for c in chunks),
                               key=lambda item: (-item[0], item[1]['id']))
        for rank, (cosine, chunk) in enumerate(vector_ranked[:8], 1):
            # Without any lexical support, weak embedding matches must not turn
            # an unknown/gibberish question into apparently grounded evidence.
            if cosine < (.55 if lexical else .65):
                continue
            candidates.setdefault(chunk['id'], {**chunk, 'matched_terms': []})
            candidates[chunk['id']]['semantic_similarity'] = round(cosine, 4)
            fusion[chunk['id']] = fusion.get(chunk['id'], 0) + 1 / (60 + rank)
        ranked = [(score, {**candidates[key], 'relevance_score': round(score, 6)})
                  for key, score in fusion.items()]
    sources = []
    # Facts are already role-scoped; an explicit machine narrows them again.
    allowed = [f for f in facts if not machine_id or f.get('machine_id') == machine_id]
    sensor_query = set(query)
    if sensor_query & {'production', 'output', 'shift'}:
        sensor_query.update({'good', 'scrap', 'part', 'target', 'cycle'})
    allowed.sort(key=lambda fact: (-len(sensor_query & set(tokens(fact.get('sensor_name', '')))),
                                   str(fact.get('machine_id', '')), str(fact.get('sensor_name', ''))))
    channels = requested_sensors(question)
    if channels:
        allowed = [f for f in allowed if f.get('sensor_name') in channels]
    for fact in allowed[:12]:
        timestamp = fact.get('timestamp')
        age = None
        freshness = 'unknown'
        if now and timestamp:
            try:
                parsed = timestamp if isinstance(timestamp, dt.datetime) else dt.datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=dt.timezone.utc)
                reference = now.replace(tzinfo=dt.timezone.utc) if now.tzinfo is None else now
                age = round((reference - parsed).total_seconds(), 1)
                freshness = ('future_timestamp' if age < -5 else
                             'fresh' if age <= stale_seconds else 'stale')
            except (ValueError, TypeError):
                pass
        expected_unit=SENSORS.get(fact.get('sensor_name'),(None,None))[0]
        unit_ok=expected_unit is None or fact.get('sensor_unit')==expected_unit
        sources.append({'id': f'T{len(sources) + 1}', 'kind': 'telemetry',
                        'title': f"{fact.get('machine_id')} {fact.get('sensor_name')}",
                        'source': 'FactoryPulse MySQL simulator_sensor_readings',
                        'reading_id': fact.get('reading_id'), 'timestamp': timestamp,
                        'age_seconds': age, 'freshness': freshness,
                        'data_quality': fact.get('data_quality'), 'unit_check_passed': unit_ok,
                        'usable_current_measurement': (unit_ok and age is not None and age >= 0 and freshness == 'fresh' and fact.get('data_quality') == 'GOOD'
                            and isinstance(fact.get('sensor_value'), (int, float))
                            and not isinstance(fact.get('sensor_value'), bool)
                            and math.isfinite(fact['sensor_value'])),
                        'excerpt': f"Value: {fact.get('sensor_value')} {fact.get('sensor_unit')}; "
                                   f"expected range: {fact.get('expected_min')} to {fact.get('expected_max')}; "
                                   f"quality: {fact.get('data_quality')}; status: {fact.get('machine_status')}. "
                                   f"Recorded at {timestamp}."})
    # Diversify long-document passages: at most two from the same heading.
    selected = []
    headings = Counter()
    remaining = list(ranked)
    covered = set()
    while remaining and len(selected) < 3:
        # Reward new question terms and penalize overlapping passages. No extra
        # provider call or query containing personnel/unauthorized machine data.
        def utility(item):
            score, candidate = item
            terms = set(candidate.get('matched_terms', []))
            novelty = len(terms - covered) / max(1, len(query))
            words = set(tokens(candidate['excerpt']))
            overlap = max((len(words & set(tokens(s['excerpt']))) / max(1, len(words | set(tokens(s['excerpt'])))) for s in selected), default=0)
            return score / max(1e-9, max(s for s, _ in ranked)) + .35 * novelty - .45 * overlap
        best = max(remaining, key=lambda item: (utility(item), item[1]['id']))
        remaining.remove(best)
        _, chunk = best
        key = (chunk['source'], chunk['section'])
        if headings[key] >= 2:
            continue
        selected.append(chunk)
        covered.update(chunk.get('matched_terms', []))
        headings[key] += 1
        if len(selected) == 3:
            break
    sources.extend(selected)
    telemetry = [s for s in sources if s['kind'] == 'telemetry']
    fresh = sum(s['usable_current_measurement'] for s in telemetry)
    warnings = []
    if any(s['freshness'] in {'stale', 'unknown', 'future_timestamp'} for s in telemetry):
        warnings.append('Some readings are stale or have unverified timestamps; do not treat them as current machine state.')
    if any(s.get('data_quality') != 'GOOD' or not s['usable_current_measurement'] for s in telemetry):
        warnings.append('Only fresh, finite, GOOD readings support a current measurement; missing, wrong-unit or bad-quality data is not healthy evidence.')
    status = 'fresh_measurements' if fresh else 'last_known_only' if telemetry else 'guidance_only' if selected else 'no_evidence'
    hybrid = vector_status['status'] == 'ready'
    return {'method': 'local_hybrid_vectors_and_authorized_sql' if hybrid else 'local_bm25_and_authorized_sql', 'sources': sources,
            'vector_search': vector_status,
            'version': 4, 'stages': ['Account and machine authorization', 'Multi-sensor query planning', 'Local vectors + BM25 rank fusion' if hybrid else 'BM25 and heading reranking', 'Coverage and diversity reranking', 'Freshness and data quality review', 'Cited-block numeric and source checks'],
            'query_plan': {'requested_sensors': sorted(channels), 'knowledge_limit': 3, 'telemetry_limit': 12},
            'limitations': ['Semantic similarity is not diagnostic confidence' if hybrid else 'Semantic index unavailable; keyword fallback active', 'Generated citations and cited-block numbers are checked; semantic entailment is not proven', 'Training guidance is not a site-approved equipment procedure'],
            'knowledge_allowlist_count': len(APPROVED_FILES), 'strategy': 'Local cosine embeddings + BM25 reciprocal-rank fusion' if hybrid else 'BM25 with heading and query-coverage reranking',
            'query': question[:2000], 'expanded_terms': sorted(query)[:40],
            'evidence_status': status, 'warnings': warnings,
            'telemetry_considered': len(allowed), 'telemetry_selected': len(telemetry),
            'fresh_good_measurements': fresh, 'knowledge_selected': len(selected),
            'knowledge_candidates': len(ranked), 'knowledge_chunks_searched': len(chunks),
            'stale_after_seconds': stale_seconds,
            'generated_at': now.isoformat() if now else None}


def local_knowledge_answer(sources):
    return '\n\n'.join(f"[{source['id']}] {source['title']}: {source['excerpt']}"
                       for source in sources if source['kind'] == 'project_knowledge')
