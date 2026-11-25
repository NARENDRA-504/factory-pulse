# Advanced FactoryPulse RAG

The assistant uses local 384-dimensional BGE embeddings and BM25 keyword search over five approved guidance files. Live facts are fetched separately from authorized MySQL queries; they are never added to the vector index.

Version 4 adds:

- Multi-sensor query planning: a question about RPM and pressure retrieves both channels. Motor temperature stays distinct from machine temperature.
- Reciprocal-rank fusion followed by query-coverage and passage-diversity ranking, bounded to three guidance passages and twelve telemetry sources.
- Local vector-file checksums and corpus revision validation. Missing or changed indexes fall back to keyword retrieval with visible availability status.
- Source checks on generated answers: citations must exist, numeric claims must appear in the cited block's sources, and machine references must match those sources. Certain explicit health claims from stale readings are rejected. Rejected answers fall back to original evidence.
- Evidence details in the chat show requested channels, retrieval stages and answer-check status.

Existing behavior retained: account and machine authorization before retrieval, per-question external AI opt-in, timestamp/quality/unit validation, Telugu/Hindi topic mapping and voice, deterministic role-specific SOP instructions, and read-only chatbot operation. No schema change, telemetry writes, Simulator edits, account changes or secret changes are required.

## Verification commands

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_advanced_rag tests.test_rag tests.test_vector_retrieval tests.test_gemini_insights tests.test_voice_chat tests.test_chat_language
.\.venv\Scripts\python.exe scripts\evaluate_rag.py
npm run lint
npm run build
```

After editing approved knowledge, explicitly rebuild:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_rag_vectors.py
```

No model download is initiated by a chat question. Preparation can download public embedding weights if absent. General conversation and private-data refusals bypass manufacturing retrieval.

## Practical limits

This is advanced bounded hybrid retrieval, not autonomous equipment control or a trained failure detector. Numeric checks are deliberately conservative: transformed or rounded numbers may be withheld. They do not prove semantic entailment, validate every translated assertion, or eliminate all hallucinations. The small retrieval evaluation is a regression suite, not production accuracy evidence. SOP instructions remain training guidance unless formally approved at the site. No new hosted vector service or LangChain dependency is needed for this implementation.
