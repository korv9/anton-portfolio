-- Sjukpenningtal 2.0: net sick-pay days per insured person over the preceding twelve
-- months, and the number of insured persons it is divided by.
select
    dimensions.lan_kod as county_code,
    dimensions.kommun_kod as municipality_code,
    dimensions.aldersklass_kod as age_code,
    dimensions.kon_kod as sex_code,
    cast(dimensions.ar as integer) as year,
    cast(dimensions.manad as integer) as month,
    observations.spt.value as sick_pay_rate,
    observations.spt.rojd as sick_pay_rate_suppressed,
    observations.namnare.value as insured_persons,
    observations.namnare.rojd as insured_persons_suppressed
from {{ source('fk', 'sick_pay_rate') }}
