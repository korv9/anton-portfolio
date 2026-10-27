# frontend

The React and TypeScript site, built with Vite and served by the Worker in `worker/`.

```bash
npm ci
npm run dev              # http://127.0.0.1:5173, the full site
npm run build            # dist/, after compliance:check and jobs:check
npm run verify:quick     # types, formatting, unit tests
```

The production build shows only the home page; every other address leads to `#start`
(`START_ONLY` in `src/router.ts`). The dev server and the browser tests keep every page.

## Where things are

| Path | What it holds |
|---|---|
| `src/router.ts` | Every address, the page it opens and the redirects from retired ones |
| `src/home/` | The home page: profile, experience, project list, cluster preview, chart feed |
| `src/meaning/` | The chart feed (`#what-does-it-even-mean`) and its Trace panel |
| `src/projects/projectRegistry.ts` | Project names, groups and menu entries |
| `src/job-assistant/` | The job assistant (`#jobs`, [docs](../docs/job-assistant.md)) |
| `src/sweden/` | The SWEDEN research pages (`#sweden*`) |
| `src/symbolic/`, `src/philosophy/`, `src/concepts/` | The three text labs |
| `src/clusters/`, `src/ask/`, `src/lawqa/`, `src/workersAi/` | Cluster visuals, Ask the platform, Ask the law, browser-side vector search |
| `src/products/` | DrugComb, the thesis, Homie and the DiVA lakehouse pages |
| `src/compliance/`, `src/companies/`, `src/job-intelligence/` | Not routed; kept because `scripts/check_compliance_release.mjs` and `check_job_companies.mjs` read them |
| `src/tokens.css` | Design tokens ([design system](../docs/design-system.md)) |
| `public/data/` | Delivered data committed for first paint, with `catalog.json` and `delivery.json` |
| `tests/` | Playwright specs and `tests/unit/` ([how to run them](tests/README.md)) |

Data paths resolve through `src/dataSource.ts`: a file either ships under `public/data/` or is
read from R2 at the address in `delivery.json` ([storage and serving](../docs/storage-and-serving.md)).
