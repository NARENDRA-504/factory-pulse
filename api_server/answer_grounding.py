"""Conservative, local checks on generated answers; never a diagnostic guarantee."""
import re
import unicodedata


def numbers(text):
    text = unicodedata.normalize('NFKC', str(text)).replace(',', '')
    return set(re.findall(r'(?<![\w-])-?\d+(?:\.\d+)?', text))


def check_answer(answer, sources):
    """Validate every cited block against its own sources, not the whole corpus.

    This catches invented numbers and uncited declarative blocks. It does not
    prove semantic entailment, and safely falls back when paraphrasing is ambiguous.
    """
    by_id = {s['id']: s for s in sources}
    citations = set(re.findall(r'\[([A-Za-z0-9-]+)\]', answer))
    reasons = []
    if not citations or not citations.issubset(by_id):
        reasons.append('missing_or_unknown_citations')
    blocks = [b.strip() for b in re.split(r'\n+|(?<=[.!?])\s+', answer) if b.strip()]
    checked = 0
    for block in blocks:
        ids = re.findall(r'\[([A-Za-z0-9-]+)\]', block)
        plain = re.sub(r'\[[A-Za-z0-9-]+\]', '', block)
        plain = re.sub(r'^\s*(?:[-*#]+|\d+[.)])\s*', '', plain).strip()
        # Headings and explicit abstentions need no factual source.
        if not ids:
            if (plain.endswith(':') and len(plain) < 90) or re.search(
                    r'\b(insufficient evidence|not available|unavailable|cannot determine)\b', plain, re.I):
                continue
            if len(plain.split()) >= 5 or numbers(plain):
                reasons.append('uncited_answer_block')
            continue
        cited = [by_id[i] for i in ids if i in by_id]
        evidence = ' '.join(str(s.get('excerpt', '')) + ' ' + str(s.get('title', '')) for s in cited)
        if not numbers(plain).issubset(numbers(evidence)):
            reasons.append('unsupported_numeric_claim')
        machines = set(re.findall(r'\bMCH-\d{3}\b', plain, re.I))
        if not machines.issubset(set(re.findall(r'\bMCH-\d{3}\b', evidence, re.I))):
            reasons.append('unsupported_machine_claim')
        if any(s.get('kind') == 'telemetry' and not s.get('usable_current_measurement') for s in cited):
            if re.search(r'\b(currently healthy|running safely|operating safely|healthy now)\b', plain, re.I):
                reasons.append('stale_data_health_claim')
        checked += 1
    return {'status': 'passed' if not reasons else 'rejected',
            'checks': ['citation_ids', 'cited_block_numbers', 'machine_ids', 'stale_health_claims'],
            'checked_blocks': checked, 'reasons': sorted(set(reasons)),
            'limitation': 'Conservative source checks; not semantic entailment or diagnostic confidence.'}
