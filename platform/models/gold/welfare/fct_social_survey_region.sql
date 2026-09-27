-- ESS weighted results for Sweden's eight NUTS2 areas, rounds 5 onward, all respondents.
-- Grain: indicator x region x round. Samples are 50-340 per area and round; read the
-- interval before comparing areas.
{{ welfare_ess_aggregate(['nuts2_code'], ref('int_welfare_ess_answers'),
                         where="country_code = 'SE' and nuts2_code is not null",
                         breakdowns=false) }}
