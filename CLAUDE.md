# Working in this repository

Always follow the graph-first rule in [AGENTS.md](AGENTS.md). Consult the existing
Graphify graph before source lookup on every coding task, review, and repository
question, even when the user does not mention Graphify.

Follow the skills in `.claude/skills/` (sources in `.claude/skills/README.md`):

- `graph-first` before source lookup on every repository task: query the existing
  graph with about 1,000 tokens, then read only the relevant code. It also applies
  when using another skill or delegating work.
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
- **`taste-skill`** (`design-taste-frontend`) on every page or style change, inside the
  confirmed direction: its design read here is "portfolio for recruiters and hiring managers,
  editorial with data, leaning toward native CSS on the tokens in `tokens.css`", with dials
  `DESIGN_VARIANCE 5 / MOTION_INTENSITY 3 / VISUAL_DENSITY 5`. Take its anti-default rules,
  AI tells (section 9) and pre-flight check (section 14); never its design-system picks,
  installs or new tokens, which `docs/design-system.md` already decides.
- **`web-design-guidelines`** to review UI code before showing it: read
  `.claude/skills/web-design-guidelines/references/guidelines.md` (baked in, no fetch) and
  report findings as `file:line`.
- **`diagram-design`** for every chart, data visualisation and diagram (architecture, data
  flow, medallion layers, ER, timelines, Sankey). Its style guide is already set to the site's
  tokens. Inside the site, draw with the CSS variables (`var(--ink)` …) so a `.plate`
  recolours the chart, and keep one focal accent.
- **`de-ai-writing`** for all prose a reader sees: page copy, project descriptions, docs, commit
  messages and PR text. Keep every fact and number; run
  `.claude/skills/de-ai-writing/scripts/check_ai_signs.py` on new copy.

Idea Lineage (`docs/idea-lineage.md`), for substantial project work only, not small fixes:

- Before: read `.idea-lineage/state/<project>.md` or `.idea-lineage/context.json` if present.
- After: write the answer's decisions, ideas, findings and open questions as labelled lines
  (`Decision:`, `Idea:`, `Finding:`, `Open question:`) and run `npm run ideas:extract` on that
  final answer. Never persist prompts or raw conversations.

Repository rules that sit beside them:

- Data is real or absent: no placeholder numbers or invented rows on any page.
- Secrets live only in GitHub and Cloudflare secrets.
- En lokal `.env` (gitignorerad) är tillåten för engångskörningar mot Cloudflare Workers AI; den checkas aldrig in.
- Checks before a push: `npm run check`, `npm run format:check`, `npm run test:unit`,
  `python -m pytest platform/tests -q`, and `npm run test:e2e` for frontend changes.
