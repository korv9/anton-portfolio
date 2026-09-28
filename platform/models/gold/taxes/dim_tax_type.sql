-- Tax types in the OECD's classification, with Swedish names for the ones the site shows.
select tax_code, name_sv, name_en, parent_code, is_headline, note_sv
from {{ ref('tax_types') }}
