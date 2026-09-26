-- ESS weighted results per country and round. Grain: indicator x country x round x sex x
-- age group, where T and 15+ are the totals.
-- ci_* is mean +/- 1.96 standard errors from the Kish effective sample size. It ignores
-- ESS's clustering and stratification, so it is narrower than a design-based interval.
{{ welfare_ess_aggregate(['country_code'], ref('int_welfare_ess_answers')) }}
