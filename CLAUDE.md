# Working in this repository

Follow the skills in `.claude/skills/` (sources in `.claude/skills/README.md`):

- **`ponytail`** on every coding task: reuse what the repository already has, the platform
  before a dependency, the smallest change that solves the root cause, and one runnable check
  for non-trivial logic. Its short-output rule applies to code comments and commit messages;
  reports the owner asks for are written in full.
- **`frontend-design-principles`** for any page, component or style change. The design
  direction is already set in `docs/design-system.md`, and tokens live only in
  `frontend/src/tokens.css`; treat those as the confirmed direction rather than proposing a new
  one, and run the swap, squint, signature and token checks before showing UI work. A new
  product page still answers the intent questions (who reads it, what they must do, how it
  should feel) for that page.
- **`diagram-design`** for every chart, data visualisation and diagram (architecture, data
  flow, medallion layers, ER, timelines, Sankey). Its style guide is already set to the site's
  tokens. Inside the site, draw with the CSS variables (`var(--ink)` …) so a `.plate`
  recolours the chart, and keep one focal accent.

Repository rules that sit beside them:

- Data is real or absent: no placeholder numbers or invented rows on any page.
- Secrets live only in GitHub and Cloudflare secrets.
- Checks before a push: `npm run check`, `npm run format:check`, `npm run test:unit`,
  `python -m pytest platform/tests -q`, and `npm run test:e2e` for frontend changes.
