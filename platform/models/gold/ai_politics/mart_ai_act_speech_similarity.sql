-- For each article of the AI Act, the Riksdag AI paragraphs closest to it in a multilingual
-- embedding space, with the Act's passage and the speech paragraph side by side. `similarity` is
-- cosine similarity; `above_chance` marks pairs above the 95th percentile of random
-- speech–Act pairs from the same run (run.json). Semantic similarity only: related language,
-- not influence, response or shared meaning. Derived.
with run as (
    select model, act_version, baseline_random_pairs.p95 as chance_p95 from {{ source('ai_politics_features', 'run') }}
)

select
    s.article_number,
    s.rank,
    s.similarity,
    s.similarity > run.chance_p95 as above_chance,
    run.chance_p95,
    s.act_passage_id,
    a.text as act_passage_sv,
    s.speech_id,
    s.paragraph,
    p.text as speech_paragraph,
    f.speech_date,
    f.party,
    f.speaker,
    f.debate_title,
    f.source_url as speech_url,
    run.model,
    run.act_version,
    'derived' as content_type
from {{ source('ai_politics_features', 'article_to_speech') }} as s
cross join run
join {{ source('ai_politics_features', 'act_passages') }} as a on a.act_passage_id = s.act_passage_id
join {{ ref('int_ai_speech_paragraphs') }} as p on p.speech_id = s.speech_id and p.paragraph = s.paragraph
join {{ ref('fact_ai_speech') }} as f on f.speech_id = s.speech_id
