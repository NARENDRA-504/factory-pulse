# SOP catalog and approval

`catalog.json` holds five generic training drafts and role-specific steps. None is an approved equipment operating procedure. No numerical operating limits, stop button, power-isolation sequence or restart sequence has been invented.

Each document has a stable `id`, `revision`, `title`, `category`, retrieval `keywords`, `status`, `machine_ids`, `scope_notice` and a `roles` mapping. Supported statuses are `training` and `approved`; withdrawn/unknown statuses are excluded. A role must have its own steps to retrieve a document.

To introduce an approved procedure, obtain the actual reviewed procedure and approval evidence first. Add its exact reviewed role instructions and explicitly applicable machine IDs. Record `approved_by`, `manual_reference`, ISO `effective_date` and ISO `review_due`; set `status` to `approved` only after approval. Retrieval excludes approved documents with missing approval metadata, wrong machine, a future effective date or an overdue review. Update the revision whenever instructions change. Do not enter secrets or personnel records.

This is a file-managed catalog, not an electronic approval workflow or document-upload service. Store edits through the normal reviewed source-control process. Editing a status field does not itself constitute organizational approval.

The SOP endpoint and chatbot perform local, role/machine-filtered retrieval. SOP chat answers quote the stored steps and cite their document ID, revision and section; they deliberately bypass generative rewriting, even when Gemini is selected. Unrelated factory analysis retains its existing per-question optional Gemini behavior.

The displayed Normal/Suspect/Critical label maps fresh received NORMAL/WARNING/CRITICAL sensor statuses. It is not a new ML detector, approved safety rule or failure forecast. Missing/stale/invalid data does not become Normal. Retrieval sends no notifications, writes no incidents and controls no machine. The proposed automatic alert routing remains a separate future integration.
