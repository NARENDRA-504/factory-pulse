# FactoryPulse chatbot retrieval and grounded answers

Implemented 3 November 2026. Factory questions use retrieval augmented generation when the user selects **Use Gemini for my next question**. Without this opt-in, the same retrieved evidence is available locally. Greetings and everyday conversation do not retrieve factory records.

## Data path

1. Authenticate the account and enforce the selected machine's server-side role and team scope.
2. Read authorized latest MySQL readings through the existing read-only fleet path. Optional downtime questions use the existing observed STOPPED interval calculation.
3. Retrieve relevant passages using local BM25 lexical ranking from the explicit allowlist in `api_server/rag.py`: `knowledge/assistant/production.md`, `readings.md`, `workflows.md` and `sop.md`. Files are split by headings, bounded, cached by content and hashed. Arbitrary workspace files and user-provided file paths are not indexed.
4. Build context with at most 12 readings and three relevant knowledge passages, plus a downtime calculation when applicable. Readings retain IDs, timestamps, age, units, quality and configured bounds.
5. With per-question AI consent, send this bounded context and the question to the configured Gemini provider. The owner explicitly approved transmission of selected telemetry, questions and these short project guidance passages. Backend secrets and personnel records are excluded.
6. Require source references in generated factory answers. Missing references or references outside the retrieved source IDs cause a local evidence fallback. Render the evidence in **Retrieved sources** under the answer.

This is a local lexical RAG implementation, not a vector/embedding service. No new database service, migration or simulator changes are required. Sources are refreshed on the next question when an approved knowledge file changes. The knowledge documents contain project definitions and workflow guidance; they are not manufacturer-approved manuals.

## Source references and limits

- `[T1]` etc. identify authorized SQL readings. The source panel shows the exact reading ID and recorded timestamp. Old last-known values are not proof of present operation.
- `[K-production-1]` etc. identify a retrieved document heading; the API includes its path and content hash.
- `[C1]` identifies the existing observed downtime calculation when requested.

The citation gate checks that references exist in retrieved evidence. It does not prove semantic entailment or guarantee every generated sentence is correct. Recommendations require human review. No machine commands, writes, account changes or safety certification can be performed by this chatbot. Missing observations, source manuals, tariffs and approved factory rates remain unavailable.

## Retrieval upgrade on 12 November 2026

The existing lexical system now has an inspectable retrieval pipeline:

- Heading sections are divided into overlapping passages of at most 900 characters, preserving information at the end of long sections. The document and each selected passage carry SHA-256 fingerprints. At most two passages from one heading and three passages total are selected.
- Explicit word expansion covers terms such as heat/temperature and speed/RPM. BM25 candidates are reranked using heading matches and query coverage. This is lexical retrieval, not a vector database, embedding service or learned semantic reranker. A relevance score is not a confidence percentage.
- An explicitly referential follow-up such as “Why?” uses the latest relevant prior question. The server filters private questions and references to a different selected machine first. History never grants access, changes the selected machine or supplies factual telemetry.
- Sensor-specific questions narrow the retrieved telemetry channels. Readings are labeled fresh, stale, unknown or future-timestamped, with finite numeric and GOOD-quality checks. The freshness limit uses the existing `TELEMETRY_STALE_SECONDS` setting. Bad quality, missing values and old readings cannot count as current healthy measurements.
- Responses expose `fresh_measurements`, `last_known_only`, `guidance_only` or `no_evidence` coverage. Local answers include a relevant guidance passage alongside readings. Gemini receives the same evidence labels only when the user opts in; its instructions require abstention where evidence is absent. Citation-ID checking remains an evidence-reference check, not semantic fact verification.
- The shared chat displays **Answer evidence review** and an expandable **How this answer was grounded** panel with the search question, passage counts, matched terms and passage fingerprints. This applies wherever the existing shared chat is available, retaining role permissions.

SOP questions still use the separate role/machine-filtered catalog and return direct procedure quotations. Generative rewriting is bypassed. Generic training instructions do not become approved manufacturer procedures through retrieval.

No schema migration, telemetry sender change, operational data write, new credentials, vector service or additional provider is required. This change does not train the proposed abnormality model or certify a diagnosis. Edit only the approved knowledge documents to update general project guidance; manage approved procedures through the separate SOP catalog review rules.

### Verification for the upgrade

The focused Python suite covers six curated relevance questions, long-section tail retrieval, source boundaries, explicit follow-ups, sensor filtering, freshness and invalid numeric evidence, empty-result status, privacy, authorization before retrieval, Gemini opt-in and citation fallback, and SOP restrictions. All 42 focused tests passed on 12 November. TypeScript and the production build passed; existing Vite configuration and bundle-size warnings remain. Isolated browser checks passed for the actual evidence-panel component in four evidence states and desktop/mobile layouts, with screenshots inspected. These checks do not verify live MySQL or Google connectivity. The updated local backend health endpoint and website returned HTTP 200; an unauthenticated chat request returned 401. No authenticated live-provider request was performed in this upgrade run.

## Verification

Run `.venv\Scripts\python.exe -m unittest tests.test_rag tests.test_gemini_insights tests.test_chat_scope -v` and `npm run lint` / `npm run build`.

Targeted tests cover relevance, empty retrieval, approved file boundaries, machine scope, stale sample age, privacy field exclusion, opt-in, source-reference fallback, provider failure, and local/general chat isolation. Provider tests use mocks unless a separate live verification result explicitly says otherwise.

On 3 November, all 25 targeted tests, TypeScript checks and production build passed (existing Vite configuration and bundle-size warnings remain). A separate real Operator question for MCH-002 retrieved 14 sources. Gemini `gemini-3.5-flash` responded with source references to its saved 120-part shift target, 360-second target cycle, and the retrieved 12-hour / 10-parts-per-hour planning definition. The sanitized result is saved in `.local/rag-live-verification.json`. This verifies one actual retrieval-to-generation path, not universal answer accuracy or live simulator delivery. No simulator files or schema were changed.
