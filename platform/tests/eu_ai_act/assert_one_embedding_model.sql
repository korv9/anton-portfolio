-- Vectors from different models are never compared: the similarity mart rests on one model.
select count(distinct model) as models
from {{ ref('mart_ai_act_speech_similarity') }}
having count(distinct model) <> 1
