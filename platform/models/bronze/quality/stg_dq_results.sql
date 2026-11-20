-- One row per dbt test per run and step: the DQ history platform/pipeline_quality.py writes
-- after every dbt step of platform/pipeline.py, passed or failed. Read here, not as a source,
-- for the same reason as stg_raw_fetch_log. Before any run has written a file it is empty.
{%- set pattern = env_var('PORTFOLIO_FEATURES', '../warehouse/features') ~ '/quality/dq_results/*/*.jsonl' %}
{%- set columns = {
    'run_id': 'VARCHAR', 'subject': 'VARCHAR', 'target': 'VARCHAR', 'executed_at': 'VARCHAR',
    'unique_id': 'VARCHAR', 'status': 'VARCHAR', 'failures': 'BIGINT',
    'execution_time': 'DOUBLE', 'message': 'VARCHAR'
} %}
{%- set found = 1 %}
{%- if execute %}
    {%- set found = run_query("select count(*) from glob('" ~ pattern ~ "')").columns[0].values()[0] %}
{%- endif %}
{%- if found %}
select
    run_id,
    subject,
    target,
    cast(executed_at as timestamptz) as executed_at,
    unique_id,
    -- test.<project>.<name>.<hash>: the readable test name.
    split_part(unique_id, '.', 3) as test_name,
    status,
    failures,
    execution_time,
    message
from read_json(
    '{{ pattern }}',
    format = 'newline_delimited',
    columns = {
    {%- for name, type in columns.items() %}
        '{{ name }}': '{{ type }}'{{ ',' if not loop.last }}
    {%- endfor %}
    }
)
{%- else %}
select
    {%- for name, type in columns.items() %}
    cast(null as {{ 'TIMESTAMPTZ' if name == 'executed_at' else type }}) as {{ name }},
    {%- if name == 'unique_id' %}
    cast(null as VARCHAR) as test_name,
    {%- endif %}
    {%- endfor %}
where false
{%- endif %}
