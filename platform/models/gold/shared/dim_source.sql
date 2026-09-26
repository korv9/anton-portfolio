select source_key, source_name, publisher, homepage_url, licence, citation
from {{ ref('sources') }}
