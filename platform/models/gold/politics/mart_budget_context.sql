-- One row per budget year, 2015-2026: who governed and who the budget was agreed with, which
-- proposal was adopted, how complete the imported expenditure frames are, and the exact
-- FiU1 point 2 roll call with its party votes, cited documents and reservations.
-- Government and adopted proposals stay separate; speech links are discovery candidates.
{% set parties = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V'] %}
with years as (
    select g.*, c.document_id as decision_document
    from {{ ref('budget_governance') }} as g
    left join {{ ref('stg_budget_coverage') }} as c using (session)
), frames as (
    select session,
        {% for actor in ['GOV'] + parties %}
        count(*) filter (where actor = '{{ actor }}') as frames_{{ actor }}{{ ',' if not loop.last }}
        {% endfor %}
    from {{ ref('stg_budget_frame') }}
    group by session
), point as (
    select *
    from {{ ref('stg_decision_point') }}
    where designation = 'FiU1' and point = 2
    qualify row_number() over (partition by session order by file_order) = 1
), votes as (
    select vote_id, list({'party': party, 'position': party_position, 'yes': yes_votes, 'no': no_votes, 'abstain': abstain_votes, 'absent': absent_votes}
        order by party) as party_votes
    from {{ ref('stg_party_vote') }}
    group by vote_id
), citations as (
    select point_id, list({'reference': document_reference, 'type': document_type, 'url': document_url, 'evidence': link_evidence} order by document_type, document_reference)
        as cited_documents
    from {{ ref('stg_point_citation') }}
    group by point_id
), reservations as (
    select point_id, list(distinct party order by party) as reservations
    from {{ ref('stg_point_reservation') }}
    group by point_id
), best_speech as (
    select vote_id, party, speech_id, speech_url
    from {{ ref('stg_speech_vote_candidate') }}
    qualify row_number() over (partition by vote_id, party
                               order by coalesce(cosine_similarity, 0) desc, file_order) = 1
), speeches as (
    select vote_id, list({'party': party, 'speech_id': speech_id, 'url': speech_url, 'evidence': 'semantic_candidate_only'} order by party) as related_speeches
    from best_speech
    group by vote_id
)
select
    y.session,
    y.budget_year,
    string_split(y.government_parties, '|') as government_parties,
    case when y.agreement_parties is null then []::varchar[]
         else string_split(y.agreement_parties, '|') end as agreement_parties,
    y.agreement_source_url,
    'https://data.riksdagen.se/dokument/' || y.decision_document as comparison_source_url,
    y.decision_document,
    y.adopted,
    case when y.adopted = 'alternative' then string_split(y.alternative_parties, '|')
         else string_split(y.government_parties, '|')
              || coalesce(string_split(y.agreement_parties, '|'), []::varchar[]) end as adopted_parties,
    coalesce(y.alternative_source_url, 'https://data.riksdagen.se/dokument/' || y.decision_document)
        as adoption_source_url,
    {
        {% for actor in ['GOV'] + parties %}
        '{{ actor }}': coalesce(f.frames_{{ actor }}, 0){{ ',' if not loop.last }}
        {% endfor %}
    } as frame_rows,
    case when coalesce(f.frames_GOV, 0) = 27 then 'complete'
         when coalesce(f.frames_GOV, 0) > 0 then 'partial'
         else 'not_imported' end as frame_status,
    p.point_id as decision_point,
    p.decision_date,
    p.vote_id,
    coalesce(v.party_votes, []) as party_votes,
    coalesce(c.cited_documents, []) as cited_documents,
    coalesce(r.reservations, []) as reservations,
    coalesce(s.related_speeches, []) as related_speeches,
    {'budget_to_decision': case when p.point_id is not null then 'exact_FiU1_point_2' else 'document_level_only' end, 'decision_to_vote': case when p.vote_id is not null then 'exact_roll_call' else 'not_imported' end, 'speech_to_vote': case when len(s.related_speeches) > 0 then 'semantic_candidate_not_a_stance' else 'not_imported' end, 'cited_document_to_point': case when len(c.cited_documents) > 0 then 'explicit_citation_not_party_support' else 'not_imported' end} as link_quality
from years as y
left join frames as f using (session)
left join point as p using (session)
left join votes as v on v.vote_id = p.vote_id
left join citations as c on c.point_id = p.point_id
left join reservations as r on r.point_id = p.point_id
left join speeches as s on s.vote_id = p.vote_id
order by y.budget_year
