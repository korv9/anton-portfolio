"""What lies around a station: the spatial features of the dooh subject (pre-registration,
docs/research/preregistrations/outdoor-preregistration.md, prediction 1).

For points in WGS84 this computes, in SWEREF99 TM:
- residents and employed residents within 1,000 m, area-weighted over SCB's DeSO (a DeSO counts
  with the share of its area inside the circle), on the division SCB used for the year;
- employees of SCB retail areas (handelsområden 2020) within 1,000 m, area-weighted the same way;
- whether a retail area with at least 500 employees lies within 300 m (a shopping location);
- distance to T-Centralen, and the number of distinct commuter-rail, local-railway and tram
  routes with a stop within 400 m.
"""
from __future__ import annotations

import duckdb

RADIUS = 1000
SHOPPING_RADIUS, SHOPPING_EMPLOYEES = 300, 500
INTERCHANGE_RADIUS = 400


def connect(deso_paths: dict[str, object], retail_path) -> duckdb.DuckDBPyConnection:
    """deso_paths: division ('2018', '2025') -> its GeoJSON."""
    con = duckdb.connect()
    con.sql("install spatial; load spatial")
    con.sql("create table deso (deso_version varchar, deso_code varchar, geom geometry, area double)")
    for version, path in deso_paths.items():
        con.sql(f"insert into deso select '{version}', desokod, geom, st_area(geom) "
                f"from st_read('{path.as_posix()}')")
    con.sql(f"create table retail as select kod as retail_code, anstallda as employees, geom, "
            f"st_area(geom) as area from st_read('{retail_path.as_posix()}')")
    return con


def project(con, points: dict[str, tuple[float, float]], table: str) -> None:
    """points: key -> (longitude, latitude) in WGS84, stored as `table` in SWEREF99 TM."""
    con.sql(f"create or replace table {table} (key varchar, lon double, lat double)")
    con.executemany(f"insert into {table} values (?, ?, ?)", [(k, lon, lat) for k, (lon, lat) in points.items()])
    con.sql(f"""create or replace table {table} as
                select key, st_transform(st_point(lon, lat), 'EPSG:4326', 'EPSG:3006', always_xy := true) as geom
                from {table}""")


def features(con, points: dict[str, tuple[float, float]], version: str, deso_year: dict[str, tuple[float, float]],
             rail_stops: dict[str, tuple[float, float, list[str]]], centre: tuple[float, float]) -> dict[str, dict]:
    """key -> features. version: the DeSO division of deso_year, deso_code -> (residents,
    employed) of the year to use; NULL values count as zero. rail_stops: id -> (longitude, latitude, route ids)."""
    project(con, points, "p")
    project(con, {"centre": centre}, "c")
    project(con, {k: (lon, lat) for k, (lon, lat, _) in rail_stops.items()}, "r")
    con.sql("create or replace table r_routes (key varchar, route_id varchar)")
    con.executemany("insert into r_routes values (?, ?)",
                    [(k, route) for k, (_, _, routes) in rail_stops.items() for route in routes])
    con.sql("create or replace table v (deso_code varchar, residents double, employed double)")
    con.executemany("insert into v values (?, ?, ?)", [(k, r, e) for k, (r, e) in deso_year.items()])
    rows = con.sql(f"""
        with circles as (select key, geom, st_buffer(geom, {RADIUS}, 64) as circle from p),
        people as (
            select c.key,
                   sum(coalesce(v.residents, 0) * st_area(st_intersection(c.circle, d.geom)) / d.area) as residents,
                   sum(coalesce(v.employed, 0) * st_area(st_intersection(c.circle, d.geom)) / d.area) as employed
            from circles as c join deso as d on d.deso_version = '{version}' and st_intersects(c.circle, d.geom)
            left join v using (deso_code)
            group by c.key
        ),
        shops as (
            select c.key,
                   sum(t.employees * st_area(st_intersection(c.circle, t.geom)) / t.area) as retail_employees,
                   bool_or(t.employees >= {SHOPPING_EMPLOYEES} and st_distance(c.geom, t.geom) <= {SHOPPING_RADIUS}) as shopping
            from circles as c join retail as t on st_intersects(st_buffer(c.geom, {RADIUS}, 64), t.geom)
            group by c.key
        ),
        rail as (
            select p.key, count(distinct rr.route_id) as interchange_routes
            from p join r on st_dwithin(p.geom, r.geom, {INTERCHANGE_RADIUS})
            join r_routes as rr on rr.key = r.key
            group by p.key
        )
        select p.key, coalesce(people.residents, 0), coalesce(people.employed, 0),
               coalesce(shops.retail_employees, 0), coalesce(shops.shopping, false),
               st_distance(p.geom, (select geom from c)) / 1000, coalesce(rail.interchange_routes, 0)
        from p left join people using (key) left join shops using (key) left join rail using (key)
        order by p.key""").fetchall()
    names = ("residents", "employed", "retail_employees", "shopping", "km_to_centre", "interchange_routes")
    return {key: dict(zip(names, values)) for key, *values in rows}
