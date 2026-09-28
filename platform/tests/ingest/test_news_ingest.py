import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import news_ingest
from news_ingest import clean, iso, merge, parse

RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>Nyheter</title>
<item><title>Riksdagen v&#228;ljer ny talman</title><link>https://example.se/a</link>
<description>&lt;p&gt;Talmannen v&#228;ljs &lt;b&gt;i dag&lt;/b&gt;.&lt;/p&gt;</description>
<pubDate>Mon, 28 Sep 2026 07:32:00 +0200</pubDate><guid>https://example.se/a</guid>
<category>Riksdagen</category></item>
<item><title></title><link>https://example.se/empty</link></item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Ekot</title>
<entry><id>urn:1</id><title>Norl\xc3\xa9n omvald</title><link href="https://example.se/b"/>
<summary type="html">&lt;ul&gt;&lt;li&gt;&lt;p&gt;Andreas Norl\xc3\xa9n (M) forts\xc3\xa4tter.&lt;/p&gt;&lt;/li&gt;&lt;/ul&gt;</summary>
<updated>2026-09-28T13:44:00+02:00</updated></entry></feed>"""


class NewsIngestTests(unittest.TestCase):
    def test_rss_and_atom_items(self):
        rss = parse("svt", RSS)
        self.assertEqual(len(rss), 1)  # the item without a title is dropped
        self.assertEqual(rss[0]["id"], "svt:https://example.se/a")
        self.assertEqual(rss[0]["title"], "Riksdagen väljer ny talman")
        self.assertEqual(rss[0]["summary"], "Talmannen väljs i dag .")
        self.assertEqual(rss[0]["published_at"], "2026-09-28T05:32:00+00:00")
        self.assertEqual(rss[0]["categories"], ["Riksdagen"])
        atom = parse("ekot", ATOM)
        self.assertEqual(atom[0]["id"], "ekot:urn:1")
        self.assertEqual(atom[0]["summary"], "Andreas Norlén (M) fortsätter.")
        self.assertEqual(atom[0]["published_at"], "2026-09-28T11:44:00+00:00")

    def test_times_and_text(self):
        self.assertIsNone(iso("not a date"))
        self.assertEqual(iso("2026-01-01T00:00:00Z"), "2026-01-01T00:00:00+00:00")
        self.assertEqual(clean("&amp;lt;b&amp;gt;x&amp;lt;/b&amp;gt;  y"), "x y")

    def test_merge_keeps_first_seen_and_files_by_month(self):
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(news_ingest, "OUT", Path(directory)):
            items = parse("svt", RSS)
            self.assertEqual(sum(merge(items, "2026-09-28T06:00:00+00:00").values()), 1)
            items[0]["title"] = "Riksdagen har valt talman"
            self.assertEqual(sum(merge(items, "2026-09-28T09:00:00+00:00").values()), 0)
            rows = [json.loads(line) for line in
                    (Path(directory) / "items-2026-09.jsonl").read_text().splitlines()]
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["first_seen"], "2026-09-28T06:00:00+00:00")
            self.assertEqual(rows[0]["last_seen"], "2026-09-28T09:00:00+00:00")
            self.assertEqual(rows[0]["title"], "Riksdagen har valt talman")


if __name__ == "__main__":
    unittest.main()
