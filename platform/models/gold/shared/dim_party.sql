-- No parliament tag: politics_check builds +tag:politics without tag:parliament, and the
-- parliament subject selects +dim_party by name (pipeline.yml).
{{ config(tags=['politics', 'news', 'ai_politics', 'sweden_futures', 'taxes']) }}
select party, name_sv, name_en, colour, founded_year from {{ ref('parties') }}
