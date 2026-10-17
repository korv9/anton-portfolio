select 'pair' as metric from {{ ref('mart_party_pair_context') }}
where same < 0 or compared <= 0 or same > compared or party_a >= party_b
union all
select 'cohesion' from {{ ref('mart_party_cohesion_context') }}
where aligned_cast < 0 or aligned_cast > comparable_cast or comparable_cast > present
   or present > eligible or abstain_votes > present
   or pm_same > pm_compared or pm_compared > roll_calls
