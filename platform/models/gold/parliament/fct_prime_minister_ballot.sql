-- One official appointment or incumbent confidence ballot; rejection needs 175 no votes.
select b.vote_key, cast(b.vote_key as date) as vote_date, b.candidate, b.candidate_party,
       b.kind, nullif(b.formed_government_key, '') as formed_government_key,
       b.source_url, b.source_sha256, b.extraction, b.note,
       b.recorded_yes as yes, b.recorded_no as no,
       b.recorded_abstain as abstain, b.recorded_absent as absent,
       b.recorded_no < 175 as approved
from {{ ref('prime_minister_ballots') }} as b
