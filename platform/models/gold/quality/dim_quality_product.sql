-- The products the quality registry covers, with their project id on the site.
select product_id, project_id, label_en, label_sv
from {{ source('quality_features', 'products') }}
