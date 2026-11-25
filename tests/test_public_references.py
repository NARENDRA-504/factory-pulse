import unittest
from urllib.parse import urlparse
from api_server.reference_library import public_references
from api_server.rag import knowledge_chunks

class PublicReferenceTests(unittest.TestCase):
    def test_fixed_https_sources_without_approval(self):
        result=public_references()
        self.assertFalse(result['site_approval'])
        self.assertFalse(result['runtime_web_access'])
        self.assertEqual(len(result['items']),4)
        for item in result['items']:
            parsed=urlparse(item['url'])
            self.assertEqual(parsed.scheme,'https')
            self.assertIsNone(parsed.username)
            self.assertTrue(item['applicability'])

    def test_rag_includes_reference_boundaries(self):
        chunks=[c for c in knowledge_chunks() if c['source'].endswith('public-references.md')]
        self.assertGreaterEqual(len(chunks),4)
        text=' '.join(c['excerpt'] for c in chunks)
        self.assertIn('not the deployed model',text)
        self.assertIn('must not be applied to Mazak',text)
