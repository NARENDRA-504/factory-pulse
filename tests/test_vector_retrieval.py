import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from api_server.rag import retrieve_context, knowledge_chunks
from api_server import vector_retrieval as vectors


class VectorTests(unittest.TestCase):
    def test_absent_index_falls_back_without_loading_model(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(vectors, 'INDEX_DIR', Path(folder)), patch.object(vectors, '_model') as model:
            result = retrieve_context('shift production target', [])
            self.assertEqual(result['method'], 'local_bm25_and_authorized_sql')
            self.assertTrue(result['sources'])
            model.assert_not_called()

    def test_changed_corpus_and_corrupt_index_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(vectors, 'INDEX_DIR', Path(folder)):
            Path(folder, 'manifest.json').write_text('{}')
            self.assertEqual(vectors.semantic_search('shift', knowledge_chunks())[1]['status'], 'unavailable')

    def test_semantic_only_candidate_can_be_found_and_scope_is_preserved(self):
        chunks = knowledge_chunks()
        desired = next(c for c in chunks if c['title'] == 'Shift production')
        with patch('api_server.rag.semantic_search', return_value=({desired['id']: .8}, {'status': 'ready'})):
            result = retrieve_context('accepted components during duty', [
                {'machine_id': 'MCH-002', 'sensor_name': 'RPM', 'employee_name': 'PRIVATE'}], 'MCH-001')
        self.assertIn(desired['id'], [s['id'] for s in result['sources']])
        self.assertNotIn('PRIVATE', str(result))
        self.assertEqual(result['telemetry_selected'], 0)

    def test_low_similarity_does_not_invent_evidence(self):
        with patch('api_server.rag.semantic_search', return_value=(
                {c['id']: .2 for c in knowledge_chunks()}, {'status': 'ready'})):
            self.assertEqual(retrieve_context('xyzzy123', [])['evidence_status'], 'no_evidence')

    def test_weak_semantic_match_without_lexical_support_abstains(self):
        with patch('api_server.rag.semantic_search', return_value=(
                {c['id']: .58 for c in knowledge_chunks()}, {'status': 'ready'})):
            self.assertEqual(retrieve_context('xyzzy123', [])['sources'], [])


if __name__ == '__main__':
    unittest.main()
