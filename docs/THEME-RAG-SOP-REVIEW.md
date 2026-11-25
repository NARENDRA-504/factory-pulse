# FactoryPulse theme, RAG depth and SOP review

Verified update: 2026-11-12.

## Interface

The shared light theme now uses soft coastal-blue surfaces, teal actions, clearer selected navigation, white panels, consistent borders, keyboard focus rings and restrained shadows. All role workspaces share these tokens. Severity colors retain their meaning. No telemetry calculations, delivery contracts or database records were changed by the theme work.

The SOP panel remains available across authorized modules. Its compact summary states what the current evidence supports. Expanded guidance shows first response, responsible team, evidence to capture and the release/restart boundary. “Why this guidance was selected” shows sensor-specific comparisons, data-quality issues and configured bounds.

## How deep is the RAG?

This is a structured, grounded retrieval system, not an embedding/vector or autonomous diagnosis system.

| Layer | What exists and was inspected |
|---|---|
| Access | Authentication and selected-machine/team checks occur before protected SQL retrieval. Other-machine history is removed from follow-up context. |
| Knowledge retrieval | Five explicitly allowlisted Markdown files; 26 passages in the inspected corpus. Bounded 900-character windows with overlap; local BM25, heading matching and query-coverage reranking; up to three diversified passages. |
| Operational evidence | Authorized latest MySQL facts, narrowed to the selected machine and query sensors. Up to 12 facts are selected for the retrieval response. |
| Quality | Freshness, finite numeric values, GOOD quality and canonical units for known physical channels determine whether a fact supports a current measurement. Stale data remains last-known evidence. |
| Follow-up | A recent authorized machine question can resolve a short follow-up; conversation does not grant permissions. |
| Optional generation | Existing per-question Gemini opt-in can receive allowed evidence. Source IDs are validated; missing/invented citations fall back. No live Gemini request was made for this update. |
| SOP path | Deterministic role/machine/document retrieval. Steps are returned directly without generative rewriting. Explicit topics or individually validated range excursions select applicable training guidance. |
| Traceability | Source IDs, document revisions and content fingerprints; existing acknowledgement checks reject a changed or inapplicable procedure. |

Limits: no embeddings/vector index, trained semantic reranker, automatic claim-entailment verification, causal diagnosis or demonstrated failure prediction. A valid citation ID does not prove that every generated sentence is supported. The existing health model remains shadow-only; this work does not promote it into an automatic alerting model.

The interface now exposes the retrieval stages and these limitations. A small curated regression evaluation returned the expected source among the top three passages for 11 of 11 questions. This is a retrieval sanity check, not a production accuracy claim or a test of live Gemini answer quality.

## Stronger SOP help

Nine training procedures at revision 0.2 cover general response, temperature, vibration, RPM, pressure, coolant, electrical readings, torque/load and unreliable sensor evidence. Operator, Supervisor, Maintenance, Manager and Admin actions differ; Super Admin uses the Admin operating boundary.

Each procedure adds the appropriate observations and inspection evidence to collect. It avoids treating hypotheses such as a failed bearing, pump, motor or cooling component as confirmed diagnoses. A machine-wide Critical status does not identify the faulty sensor: automatic topic matching uses each valid sensor's own configured-range comparison. Combined excursions can retrieve two distinct topics. A missing or invalid newest sample cannot be hidden by an older good sample.

Approved procedures still require explicit machine mapping, a real approving owner, manual reference and valid effective/review dates. Where available in the same topic, an applicable approved document takes precedence over a training draft. No approval metadata was fabricated. Current built-in documents remain training guidance.

The recommendations distinguish ordinary stopping, emergency response and energy isolation, and leave exact physical actions to equipment/site-approved procedures and authorized personnel. A cleared reading, SOP acknowledgement or closed ticket does not authorize restart. The general hazardous-energy reference reviewed was [OSHA's overview](https://www.osha.gov/control-hazardous-energy/) and [1910.147](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.147); these references are not site approval, a machine procedure or a claim of local regulatory compliance.

## Checks and practical limits

- 34 focused RAG/SOP tests passed, including wrong units, stale/future/noisy/nonfinite readings, latest-sample selection, multi-topic response, role isolation, applicable approval precedence and citation fallback.
- 40 existing reliability, readiness, SOP acknowledgement and Super Admin tests passed using isolated fixtures/databases.
- TypeScript check and production build passed. Existing Vite configuration and bundle-size warnings remain.
- Desktop/mobile preview passed for all six roles, response plans, topic changes, evidence details, retrieval limitations and navigation. Preview screenshots are labeled fixture data; they are not proof of a live machine fault.
- No migration, credential change, account change, telemetry deletion or external AI call was needed. The Simulator remains in manual stopped mode. Last-known readings should appear stale while it is intentionally stopped.

To use: open FactoryPulse, select an authorized machine, expand **SOP · What to do next**, and inspect the response plan or choose a topic. In chat, ask for the machine's SOP or “what should I do?” to use the direct procedure path. Refresh guidance to reassess saved evidence; the panel does not start telemetry or control equipment.
