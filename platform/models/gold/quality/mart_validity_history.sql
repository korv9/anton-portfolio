-- Validity diagnostics across recorded runs (for the Symbolic Atlas: before and after paratext
-- cleaning), so a change in a confounder's effect can be followed.
select analysis_id, product_id, run_label, experiment, metric, value
from {{ source('quality_features', 'validity_history') }}
