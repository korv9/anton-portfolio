-- SCB's party preference survey (PSU): "if there were an election today", every May and
-- November (some years also February), 1972 to now, with the margin of error SCB publishes.
-- Bloc totals (c+fp+m+kd, s+v+mp) are left out: blocs are defined downstream, per period.
with rows as ({{ pxweb_rows(source('scb_elections', 'psu')) }})
select
    make_date(cast(substr({{ px_dim('Tid') }}, 1, 4) as integer),
              cast(substr({{ px_dim('Tid') }}, 6, 2) as integer), 1) as survey_month,
    case lower({{ px_dim('Parti') }}) when 'övr' then 'OTHER'
         else {{ parliament_party(px_dim('Parti')) }} end as party,
    {{ px_value('ME0201B1') }} as share_pct,
    {{ px_value('ME0201B2') }} as change_since_election_pp,
    {{ px_value('ME0201B3') }} as change_since_last_survey_pp,
    {{ px_value('ME0201B4') }} as margin_of_error_pp
from rows
where lower({{ px_dim('Parti') }}) in ('s', 'm', 'sd', 'v', 'c', 'kd', 'mp', 'l', 'fp', 'nyd', 'övr')
  and {{ px_value('ME0201B1') }} is not null
