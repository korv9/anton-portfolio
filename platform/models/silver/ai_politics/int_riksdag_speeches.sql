-- Every Riksdag speech with a normalised party code, its month and year. The chair (Talmannen
-- and the deputy Speakers) speaks in role, not for a party, and gets no party; so do ministers
-- and members without a party in the export ('-').
select
    speech_id,
    session,
    speech_date,
    date_trunc('month', speech_date) as speech_month,
    year(speech_date) as speech_year,
    protocol_id,
    debate_title,
    debate_kind,
    speaker,
    party_raw,
    case
        when upper(coalesce(party_raw, '')) like '%TALMAN%' then null
        when {{ parliament_party('party_raw') }} in ('S', 'M', 'SD', 'C', 'V', 'KD', 'L', 'MP')
            then {{ parliament_party('party_raw') }}
    end as party,
    is_reply,
    paragraph_count,
    word_count,
    text,
    source_url,
    archive_hash
from {{ ref('stg_riksdag_speeches') }}
where speech_date is not null
