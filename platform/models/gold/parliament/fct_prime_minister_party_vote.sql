-- Source party names remain available: FP is canonical L, independent members remain '-'.
select vote_key, party, source_party, yes, no, abstain, absent,
       yes + no + abstain + absent as members,
       case when yes + no + abstain + absent = 0 then 'not_represented'
            when yes + no + abstain = 0 then 'absent'
            when (yes > 0)::int + (no > 0)::int + (abstain > 0)::int > 1 then 'mixed'
            when yes > 0 then 'yes' when no > 0 then 'no' else 'abstain' end as position
from {{ ref('prime_minister_party_votes') }}
