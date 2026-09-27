-- Governments since 1991: who governed, with which parties, and on which agreement.
select
    government_key, government_name, prime_minister, prime_minister_party,
    string_split(government_parties, '|') as government_parties,
    start_date, end_date, agreement_name,
    case when agreement_parties is not null then string_split(agreement_parties, '|') end
        as agreement_parties,
    status_note, source_url,
    end_date is null as is_current
from {{ ref('governments') }}
