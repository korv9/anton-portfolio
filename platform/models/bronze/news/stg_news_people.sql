-- Politicians in office now, one row per name, for tagging news by the people it names. A name
-- two people share is left out rather than guessed, and so is a member of the Riksdag with one
-- of the thirty most common Swedish surnames (SCB's name statistics): "Johan Andersson" in the
-- news is more often someone else. Ministers and the Speakers always count; news about an
-- ordinary member usually names the party anyway, and the party terms catch that.
with people as (
    select unnest(people, recursive := true)
    from {{ source('news', 'people') }}
), named as (
    select name, any_value(party) as party, string_agg(role, '; ') as role,
           bool_or(not role like 'Tjänstgörande%' and not role like 'Tjänstledig%'
                   and role <> 'Europaparlamentariker') as holds_office
    from people
    group by name
    having count(distinct party) = 1
)
select name, party, role, holds_office
from named
where holds_office
   or split_part(name, ' ', -1) not in (
        'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson',
        'Persson', 'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson',
        'Bengtsson', 'Jönsson', 'Lindberg', 'Carlsson', 'Petersson', 'Magnusson', 'Lindström',
        'Gustavsson', 'Olofsson', 'Lindgren', 'Axelsson', 'Berg', 'Bergström', 'Lundberg',
        'Lind', 'Jakobsson')
