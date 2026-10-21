-- Ads and vacancies per publication day and occupation field from JobTech's stream.
select * from {{ source('jobtech_market', 'daily') }}
