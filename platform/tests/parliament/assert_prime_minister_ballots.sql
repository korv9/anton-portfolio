-- Missing observations never become abstentions; every reviewed ballot accounts for 349 seats.
with counts as (
    select vote_key, sum(yes) as yes, sum(no) as no,
           sum(abstain) as abstain, sum(absent) as absent
    from {{ ref('fct_prime_minister_party_vote') }} group by vote_key
)
select b.vote_key from {{ ref('fct_prime_minister_ballot') }} b
left join counts c using (vote_key)
where c.vote_key is null or c.yes <> b.yes or c.no <> b.no
   or c.abstain <> b.abstain or c.absent <> b.absent
   or c.yes + c.no + c.abstain + c.absent <> 349
   or b.approved <> (b.no < 175)
   or (b.formed_government_key is not null and not b.approved)
