-- The municipality panel exactly as the 2024 clustering read it (a hashed copy of
-- gold.mart_municipality_year_panel), so C does not move when the live panel is revised.
select * from {{ source('sweden_similarity', 'panel') }}
