-- The risk classes as the Act frames them, with the sentence each rests on. `common_name_en` is
-- the label often used outside the Act ("limited risk", "minimal risk" are not terms of the Act).
select
    risk_class_id,
    label_en,
    label_sv,
    legal_basis,
    source_article,
    source_quote,
    common_name_en,
    description_en,
    description_sv,
    sort_order,
    'interpretation' as description_type
from {{ ref('ai_act_risk_classes') }}
