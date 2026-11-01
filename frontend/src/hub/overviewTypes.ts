/** The dbt project's size, from the schema export (platform/publish/export_schema.py). */
export type Summary = { models: number; tests: number; rows: number }

/** The run figures of quality/summary.json. */
export type Quality = {
  run: { checks: number; check_statuses?: Record<string, number> }
}
