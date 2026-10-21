-- The Lost Futures: calendar year × words in the speech over all Riksdag speeches, so the future
-- share can be compared within fixed length bands. Speeches above the ingest's cap share its bin.
select try_cast(year as integer) as year, words,
       sum(speeches) as speeches, sum(future) as future_speeches
from {{ ref('stg_futures_lengths') }}
where try_cast(year as integer) is not null
group by all
