-- The Ideal Human by who advertises: year × SSYK-4 occupation group × employer type × category,
-- over distinct ad texts. The group comes from the ad's occupation through JobTech's taxonomy
-- (Unknown when it has none); the employer type reads the employer name as a staffing or
-- recruitment agency, another employer, or unknown (no name). The export decomposes each change
-- into a part within groups and a part from the groups' changing mix.
select try_cast(year as integer) as year, occupation_group, employer_type, category,
       sum(texts) as texts, sum(words) as words,
       sum(texts_matching) as texts_matching, sum(matches) as matches
from {{ ref('stg_ad_language_mix') }}
where try_cast(year as integer) is not null
group by all
