-- Government bills (propositioner) since 2006/07, each with the committee reports it was dealt
-- with in and the studies it names as its preparation. Read directly here: the read options
-- need braces that a source's external_location cannot hold.
select
    prop_id,
    session,
    number,
    session || ':' || number as bill,
    title,
    try_cast(nullif(date, '') as date) as bill_date,
    nullif(department, '') as department,
    reports,
    "references",
    has_section,
    source_url
from read_json(
    '{{ env_var('PORTFOLIO_RAW', '../warehouse/raw') }}/riksdagen/studies/preparation/*.jsonl.gz',
    format = 'newline_delimited', maximum_object_size = 50000000,
    columns = {prop_id: 'VARCHAR', session: 'VARCHAR', number: 'VARCHAR', title: 'VARCHAR',
               date: 'VARCHAR', department: 'VARCHAR', committee: 'VARCHAR',
               reports: 'STRUCT(report_id VARCHAR, session VARCHAR, designation VARCHAR, title VARCHAR)[]',
               has_section: 'BOOLEAN', section: 'VARCHAR',
               "references": 'STRUCT(kind VARCHAR, "key" VARCHAR, title VARCHAR, diary VARCHAR, context VARCHAR, section VARCHAR)[]',
               source_url: 'VARCHAR', fetched_at: 'VARCHAR'})
-- Budget bills come in one document per expenditure area; the bill is its main document.
qualify row_number() over (partition by session, number order by length(prop_id), prop_id) = 1
