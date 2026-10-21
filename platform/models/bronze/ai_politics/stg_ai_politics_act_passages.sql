-- The AI Act's Swedish passages as the similarity stage split them.
select * from {{ source('ai_politics_features', 'act_passages') }}
