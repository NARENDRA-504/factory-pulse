# Local vector retrieval

FactoryPulse combines BM25 keyword/heading retrieval with local BAAI/bge-small-en-v1.5 embeddings (384 dimensions, FastEmbed/ONNX CPU). Cosine candidates at or above 0.55 enter reciprocal rank fusion; a maximum of three guidance passages reaches the answer. Similarity is search relevance, not diagnosis confidence or a safety approval.

Only the five explicitly allowlisted files in knowledge/assistant are indexed. Telemetry remains in MySQL and is selected through existing account/machine authorization, freshness, unit and quality checks. Personnel records, credentials and workspace documents are not embedded. Question vectors are transient. No external embedding API is used. Optional Gemini delivery retains the existing per-question opt-in and scope rules.

Install with the project Python environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r api_server\requirements-rag.txt
.\.venv\Scripts\python.exe scripts\prepare_rag_vectors.py
```

The preparation command downloads public model weights and writes a local corpus index under ignored .local/rag-vectors. Re-run it after changing approved guidance. Web requests load cached weights with local_files_only=True; they never initiate model downloads. Missing dependencies, unavailable weights, corrupt vectors or changed corpus select the keyword fallback and disclose that status in answer evidence details. Delete .local/rag-vectors to disable semantic retrieval without affecting SQL or telemetry.

This is semantic retrieval, not ML failure prediction, model fine-tuning, or a LangChain migration. Physical SOP actions still use the separate deterministic, approval-aware SOP path. Retrieval does not prove that every generated claim is supported.
