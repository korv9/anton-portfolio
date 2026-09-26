-- One row per ESS respondent. Codes above the valid range (77 refusal, 88 don't know,
-- 99 no answer, 999 age not given) are kept as they are; silver applies the valid ranges.
select
    regexp_extract(filename, '/(ESS[0-9]+)/', 1) as study,
    regexp_extract(filename, '/([^/]+)\.csv\.gz$', 1) as datafile,
    cast(essround as integer) as essround,
    cntry as country_code,
    cast(idno as bigint) as respondent_id,
    try_cast(pspwght as double) as post_stratification_weight,
    try_cast(dweight as double) as design_weight,
    try_cast(anweight as double) as analysis_weight,
    try_cast(gndr as integer) as gender_code,
    try_cast(agea as integer) as age,
    region as region_code,
    regionse as region_se_code,
    * exclude (name, essround, edition, proddate, idno, cntry, dweight, pspwght, pweight,
               anweight, gndr, agea, region, regionse, filename)
from {{ source('ess', 'respondents') }}
