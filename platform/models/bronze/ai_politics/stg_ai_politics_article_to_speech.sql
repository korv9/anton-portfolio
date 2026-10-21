-- Per AI Act article, the nearest Riksdag AI paragraphs by embedding similarity.
select * from {{ source('ai_politics_features', 'article_to_speech') }}
