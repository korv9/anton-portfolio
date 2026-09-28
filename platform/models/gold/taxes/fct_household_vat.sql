-- An estimate of the VAT a household pays in a year: its spending per group (SCB HUT), prices
-- including VAT, times rate / (1 + rate). Only groups with one clear rate are counted; rent,
-- health care, insurance, interest and fees carry no VAT or a mix and are left out, so the
-- estimate is a floor, not a total.
select
    s.household_type,
    h.name_sv as household_sv,
    h.name_en as household_en,
    s.year,
    s.spending_group,
    g.name_sv,
    g.name_en,
    g.vat_rate,
    s.sek_per_household,
    s.sek_per_household * g.vat_rate / (100 + g.vat_rate) as vat_sek,
    g.note_sv
from {{ ref('stg_scb_household_spending') }} as s
join {{ ref('household_types') }} as h using (household_type)
join {{ ref('vat_spending_groups') }} as g on g.spending_group = s.spending_group
