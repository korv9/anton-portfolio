-- A representative passage is exactly the chunk's own text: nothing is paraphrased.
select p.chunk_id
from {{ ref('mart_concept_passages') }} as p
join {{ ref('dim_text_chunk') }} as k using (chunk_id)
where p.text <> k.text
