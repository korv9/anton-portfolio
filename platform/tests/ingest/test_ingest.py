import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path
from ingest import FIELDS, discover, import_file, is_debate

class IngestTests(unittest.TestCase):
    def test_metadata_not_speech_mentions(self):
        self.assertFalse(is_debate({'anforandetext': 'En partiledardebatt'}))
        self.assertTrue(is_debate({'avsnittsrubrik': 'EU-politisk partiledardebatt'}))
        self.assertFalse(is_debate({'avsnittsrubrik': 'Meddelande om partiledardebatt'}))

    def test_discovery_deduplicates(self):
        url = 'https://data.riksdagen.se/dataset/anforande/anforande-19992000.json.zip'
        self.assertEqual(discover(url + ' ' + url), [url])

    def test_unicode_repeat_import_and_rollback(self):
        row = dict.fromkeys(FIELDS, '')
        row.update(dok_id='TEST', anforande_nummer='1', avsnittsrubrik='Partiledardebatt',
                   anforandetext='<p>Åäö, "citat" &amp; tack</p>\nNy rad', replik='Y', parti=None)
        db = sqlite3.connect(':memory:')
        db.execute('CREATE TABLE speeches (' + ','.join(k + ' TEXT' for k in FIELDS) +
                   ',source_url TEXT,dataset_url TEXT,PRIMARY KEY(dok_id,anforande_nummer))')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'test.zip'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('test.json', json.dumps({'anforande': row}))
            for _ in range(2):
                self.assertEqual(import_file(db, path, 'source')['speeches'], 1)
            self.assertEqual(db.execute('SELECT anforandetext,parti FROM speeches').fetchall(),
                             [('Åäö, "citat" & tack\n\nNy rad', '')])
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('test.json', '{bad json')
            with self.assertRaises(ValueError):
                import_file(db, path, 'source')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM speeches').fetchone()[0], 1)
        db.close()


def test_speech_archives_include_the_session_written_with_eight_digits():
    """1999/2000 is published as anforande-19992000, not as six digits like every other session."""
    from ingest_speeches import archives
    page = ('https://data.riksdagen.se/dataset/anforande/anforande-199899.json.zip '
            'https://data.riksdagen.se/dataset/anforande/anforande-19992000.json.zip '
            'https://data.riksdagen.se/dataset/anforande/anforande-200001.json.zip')
    assert [c for c, _ in archives(page, "1999/2000")] == ["19992000", "200001"]


if __name__ == '__main__':
    unittest.main()
