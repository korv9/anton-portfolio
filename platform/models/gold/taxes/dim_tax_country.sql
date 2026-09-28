-- OECD countries and the OECD and EU averages, with Swedish names.
select * from {{ ref('tax_countries') }}
