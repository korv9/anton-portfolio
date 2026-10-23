-- The Swedish check: one row per foundation once the owner's labels exist, else one row with no
-- foundation. gate.json always carries every key; the casts fix the types of a pending file's nulls.
with gate as (
    select
        cast(status as varchar) as status,
        cast(passages as integer) as passages,
        cast(raters as integer) as raters,
        cast(swedish_macro_f1 as double) as swedish_macro_f1,
        cast(english_macro_f1 as double) as english_macro_f1,
        cast(ratio_required as double) as ratio_required,
        cast(passed as boolean) as passed,
        cast(foundations as struct(foundation varchar, positives integer, swedish_f1 double, english_f1 double,
                                   validated boolean)[]) as foundations
    from {{ source('philosophy_moral', 'gate') }}
)
select g.status, g.passages, g.raters, g.swedish_macro_f1, g.english_macro_f1, g.ratio_required, g.passed,
       f.foundation, f.positives, f.swedish_f1, f.english_f1, f.validated
from gate as g
left join lateral (select unnest(g.foundations, recursive := true)) as f on true
