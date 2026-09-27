-- Each decision in the per-session indexes must reach the vote mart: an inner join that
-- lost one (a roll call without a point or without party rows) would fail here.
select (select count(*) from {{ ref('stg_decision_index') }}) as indexed,
       (select count(*) from {{ ref('mart_vote_decisions') }}) as delivered
where (select count(*) from {{ ref('stg_decision_index') }})
   <> (select count(*) from {{ ref('mart_vote_decisions') }})
