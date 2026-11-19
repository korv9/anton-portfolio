-- Stockholm has 100 metro stations; a different count means GTFS and the station key disagree.
select count(*) as stations from {{ ref('dim_dooh_station') }} having count(*) <> 100
