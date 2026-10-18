import type { CompanyData, Job } from '../companies/model'
export default function JobFilters({
  jobs,
  data,
  params,
  change,
  clear,
  privateMode,
}: {
  jobs: Job[]
  data: CompanyData
  params: URLSearchParams
  change: (key: string, value: string) => void
  clear: () => void
  privateMode: boolean
}) {
  const choices = (key: 'skill' | 'location' | 'seniority') =>
    [
      ...new Set(
        jobs.flatMap((j) =>
          key === 'skill'
            ? j.normalized_skills || j.technologies
            : key === 'seniority'
              ? j.seniority || []
              : j.location
                ? [j.location]
                : [],
        ),
      ),
    ].sort()
  return (
    <div className="ji-filters">
      <label>
        Search jobs
        <input
          type="search"
          name="job-search"
          autoComplete="off"
          value={params.get('q') || ''}
          onChange={(e) => change('q', e.target.value)}
        />
      </label>
      <div className="ji-filter-grid">
        {(['skill', 'location', 'seniority'] as const).map((key) => (
          <label key={key}>
            {
              {
                skill: 'Skill',
                location: 'Location',
                seniority: 'Seniority mentioned',
              }[key]
            }
            <select
              name={key}
              value={params.get(key) || ''}
              onChange={(e) => change(key, e.target.value)}
            >
              <option value="">All</option>
              {choices(key).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Verified company
          <select
            name="company"
            value={params.get('company') || ''}
            onChange={(e) => change('company', e.target.value)}
          >
            <option value="">All</option>
            {data.companies.map((c) => (
              <option key={c.company_id} value={c.company_id}>
                {c.registered_legal_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {privateMode && (
        <label>
          Sort
          <select
            name="sort"
            value={params.get('sort') || 'match'}
            onChange={(e) => change('sort', e.target.value)}
          >
            <option value="match">Best match</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      )}
      {['q', 'skill', 'location', 'seniority', 'company'].some((k) =>
        params.has(k),
      ) && (
        <button type="button" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}
