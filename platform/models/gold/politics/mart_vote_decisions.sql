-- One row per roll call in site order: the index's decision with its committee point and the
-- eight parties' positions and member counts from fact_party_vote. Delivered as
-- gold/marts/votes/<session>.json.
with parties as (
    select vote_id, to_json(list({
        'party': party, 'party_position': party_position, 'yes_votes': yes_votes,
        'no_votes': no_votes, 'abstain_votes': abstain_votes, 'absent_votes': absent_votes
    } order by party)) as parties
    from {{ ref('stg_party_vote') }}
    group by vote_id
)
select
    d.slug,
    d.file_order,
    p.session,
    p.point_id,
    json_merge_patch(d.decision, json_object('point_id', p.point_id, 'parties', v.parties)) as decision
from {{ ref('stg_decision_index') }} as d
join {{ ref('stg_decision_point') }} as p on p.vote_id = d.vote_id
join parties as v on v.vote_id = d.vote_id
