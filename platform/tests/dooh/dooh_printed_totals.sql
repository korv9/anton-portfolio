-- The metro totals each edition of "Fakta om SL och länet" prints: "Tunnelbana totalt" in the
-- 2013–2017 appendix, the sum of the three "Totalt … linjen" rows in 2018–2020, and of the three
-- line totals on the 2021 and 2022 maps, which are rounded to thousands. The station sums must
-- come within 1,000 boardings of them (2020's line rows add up to 300 fewer than its stations).
with printed(year, printed) as (
    values (2013, 1203100), (2014, 1205300), (2015, 1235000), (2016, 1273100), (2017, 1276900),
           (2018, 1286600), (2019, 1265900), (2020, 801800), (2021, 723000), (2022, 912000)
), totals as (
    select year, sum(boardings) as total from {{ ref('fct_dooh_station_year') }} group by year
)
select p.year, p.printed, t.total
from printed as p full join totals as t using (year)
where t.total is null or p.printed is null or abs(t.total - p.printed) > 1000
