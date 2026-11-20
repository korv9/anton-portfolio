def test_speech_archives_include_the_session_written_with_eight_digits():
    """1999/2000 is published as anforande-19992000, not as six digits like every other session."""
    from ingest_speeches import archives
    page = ('https://data.riksdagen.se/dataset/anforande/anforande-199899.json.zip '
            'https://data.riksdagen.se/dataset/anforande/anforande-19992000.json.zip '
            'https://data.riksdagen.se/dataset/anforande/anforande-200001.json.zip')
    assert [c for c, _ in archives(page, "1999/2000")] == ["19992000", "200001"]

