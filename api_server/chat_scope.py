"""Narrow manufacturing chat scope; rejects unrelated requests before data/provider access."""
import re
DOMAIN=re.compile(r'\b(machine[\w]*|production|manufactur[\w]*|factory|plant[\w]*|fleet|sensor[\w]*|reading[\w]*|telemetry|rpm|spindle|vibrat[\w]*|temperatur[\w]*|torque|current|coolant|power|motor|downtime|stoppage|maintenance|inspection|incident[\w]*|work[ -]?order[\w]*|output|shift[\w]*|target[\w]*|quality|defect[\w]*|cycle[\w]*|throughput|oee|utilization|utilisation|alert[\w]*|fault[\w]*|tool[\w]*|safety|sop|MCH-\d+)\b',re.I)
UNRELATED=re.compile(r'\b(password[\w]*|credential[\w]*|api[ -]?key[\w]*|secret[\w]*|salary|salaries|payroll|politic[\w]*|election[\w]*|movie[\w]*|recipe[\w]*|poem[\w]*|joke[\w]*|football|cricket|horoscope|dating)\b',re.I)
FOLLOWUP=re.compile(r'^(why|how so|explain(?: more| that)?|what (?:does that|about that)|tell me more|summari[sz]e(?: that)?|compare(?: them| those)?|what should (?:i|we) do|is (?:it|that) (?:safe|normal)|and now)[?.! ]*$',re.I)

def in_scope(question,prior_questions=()):
    if UNRELATED.search(question):return False
    if DOMAIN.search(question):return True
    return bool(FOLLOWUP.fullmatch(question.strip()) and any(DOMAIN.search(q) and not UNRELATED.search(q) for q in prior_questions))
