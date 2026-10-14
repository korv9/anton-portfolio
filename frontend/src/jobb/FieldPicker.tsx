import type { Route } from '../router'
import { fieldName, yearAds, type Market } from './data'
import { useFields } from './selection'

/** The occupation fields as words to press: any number, none means the whole market. */
export default function FieldPicker({
  route,
  data,
}: {
  route: Route
  data: Market
}) {
  const { selected, toggle } = useFields(
    route,
    data.fields.map((f) => f.id),
  )
  const size = (id: string) => yearAds(data, [id], data.latest_year)
  const fields = [...data.fields].sort((a, b) => size(b.id) - size(a.id))
  return (
    <div className="report-chips" role="group" aria-label="Occupation fields">
      {fields.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={selected.includes(f.id)}
          onClick={() => toggle(f.id)}
        >
          {fieldName(f.name)}
        </button>
      ))}
    </div>
  )
}
