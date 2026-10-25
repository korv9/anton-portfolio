# Site goals: the finish line for antonernstsson.com

The site is done when every goal below is met. Each goal has checks that can be verified, so work can continue product by product until all boxes are ticked. Task IDs (e.g. `jobs-3`) refer to [product-inventory.md](product-inventory.md), which holds the full task tables from the product reviews of 2026-10-25.

Rule for every product: it must carry real value and never look unfinished. Honest limits stay, but they are stated as method or scope, not as "not done", and the strongest result comes first.

Progress is measured with `npm run goals` (scripts/goals.mjs): it opens every product route on desktop and phone and reports the site-wide checks below. Tick a box here only when its check passes on main.

## Site-wide

- [ ] **One look.** Every page is ivory on charcoal (`body` background `rgb(36, 36, 34)`), Helvetica Neue display type, the signature gradient on titles, no rules between sections.
- [x] **No "not done" signals.** No visible text matching: `not reviewed`, `0 reviewed`, `no reviewed`, `not published yet`, `so far` (as progress), `not yet explained`, `could not be read`, `Loading…` after load, `Cluster \d+` / `Group \d+` as a name, bare numeric legend labels.
- [ ] **Clean loads.** No console errors, no failed requests (403/404/5xx) on any product route; no route waits more than 3 s before showing content or a loading state.
- [x] **Accessible.** axe passes on every route; no horizontal scroll at 320, 375, 768, 1440 px; every interactive element reachable by keyboard.
- [ ] **Claims match data.** Every number on a page comes from a committed or released file, and no copy claims more than the data shows (the corrections listed in each product's inventory section are done).
- [ ] **Both languages.** Every product page reads fully in Swedish and English (titles, labels, legends).
- [x] **One count.** The platform's figures (dbt models, tests, sources, workflows) agree everywhere they appear, from one source file.

## Start page (#start)

- [x] Education sits under Experience in one column on the left, with cluster visualisations on the right, animated in 3D with depth (layered, slow, pointer-reactive, still under reduced motion).

## Projects page (#projects)

- [x] Charcoal page with Arbetsförmedla as the lead and three parts (merged in #166).
- [x] Projects listed one under another with generous space, the text on the left and a visualisation or chart on the right of each (sketch first).
- [x] No status words or route hashtags under the projects ("LIVE · #sweden" removed); no run/count mono lines on the cards.
- [x] Every project has its visual, including Cluster Visuals, the data platform and the three other projects.
- [ ] Each card links to a finished project page (below).
- [x] Replik has its card under "Running on the data platform".

## Arbetsförmedla (#jobs)

Goal: a visitor sees a working CV-to-ads matcher with real matches and why each one fits.

- [ ] Matching runs again: the 403 is gone, D1 is set up, a profile is approved, `matches.json` has a profile and matches (jobs-1).
- [x] No owner-only section is visible to visitors; nothing shows "could not be read" or "0 of 50" (jobs-2, jobs-3).
- [x] Copy says how often it really runs; the hub's freshness line checks the matcher's own limit (jobs-4, jobs-5).
- [x] The name is safe: a "not affiliated with Arbetsförmedlingen; uses its open JobTech data (CC0)" line, or a new name (jobs-6).
- [ ] Remaining P1: jobs-7.

## SWEDEN (#sweden, A–E, X)

Goal: six research products that each lead with their strongest, verified result.

- [x] The 3D Atlas is unreachable from menus and routes (sweden-H-1).
- [x] Every page leads with its strongest finding, not the contrary one (sweden-H-2).
- [x] C leads with "208 of 280 most similar in another county, 180 km vs 22 km", and shows no group as a finding that failed its pre-registered check (sweden-C-1, C-2); the Three Swedens Mantel tests appear on C.
- [x] X's header works on desktop and phone (sweden-X-1).
- [x] No progress wording on B and E; E states its −84 % result (sweden-B-1, E-2).
- [x] English pages show English labels (D's group labels).

## What does it even mean? (#what-does-it-even-mean)

Goal: a feed where every card is readable, correct and worth its place.

- [x] The polarization post is retitled to what the comparable measures show (meaning-1).
- [x] The full-time share bug is fixed (meaning-2).
- [x] No clipped, overlapping or cut-off thumbnail remains; the ~10 weak posts are in `DROPPED`; dead ids are removed from `DROPPED`.
- [x] The page uses the charcoal tokens; the dead light palette is removed.
- [x] The strongest posts lead the feed.

## Allegora (#fraga-lagen)

Goal: ask a question about Swedish law or the AI Act and see a verified answer within seconds.

- [x] The page opens on a ready-made verified answer and shows a loading state; Swedish-law data loads in under 3 s on a normal connection (allegora-1, allegora-2).
- [ ] English AI Act examples are published (allegora-3).
- [ ] The eval is dated, re-scored with the current quote checker, and its date shows on the page (allegora-4).
- [x] The showcase example cites the right article; the phone page is not overly long.
- [x] Ask the platform: no raw ids in its example, and its placeholder is a question it answers well.

## Cluster Visuals (#cluster-visuals)

Goal: every clustering on the site, legible, with honest names.

- [x] No bare-number or "Cluster N" names; every legend entry reachable; enough distinct colours.
- [x] The duplicate debate map and the Riksdag session map are removed.
- [x] Copy says names were proposed by a language model; municipality groups carry their stability result.
- [x] Total payload under 5 MB on first view; no 404s.
- [x] The page is mostly visual: every clustering dataset we have (14, see the cluster-maps inventory) drawn large in the site's warm greys, with a title and one line each; method text tucked away.

## The data platform (#projects-platform)

Goal: a hiring manager for data engineering sees a real, healthy, tested platform in one minute.

- [x] No GitHub calls from the page: run history comes from `status/runs.json` (platform-1).
- [ ] One model count everywhere; every export refreshed by the pipeline, none older than its own SLA (platform-2, platform-3).
- [x] Quality bars count only checks that apply.
- [x] No "failed" step without its cause; no section stuck on "Loading…"; Machinery reads in Swedish too.
- [ ] Remaining P1: platform-4 to platform-7.

## Symbol Lab (#symbolic-atlas)

Goal: a rigorous unsupervised study that shows contexts crossing traditions.

- [x] No review-count UI or "Not reviewed" badges; the naming rule is described as a method choice.
- [x] The map opens on Cross-book; a "Contexts that cross traditions" strip shows the top clusters.
- [x] "Model quality" is renamed cluster geometry; the lessons table compares like with like; paratext and registry wording corrected.

## Philosophy Lab (#philosophy-atlas)

Goal: show that correcting for each work's voice reveals ideas shared across works (6 → 19).

- [x] No "none has been yet" or "not reviewed" text; groups are shown by their distinctive words, not "Group N".
- [x] Registry copy matches the data, or the 19 cross-work groups are reviewed by hand and the copy says so.
- [ ] Junk words removed from group word lists.

## Concept Lab (#concept-journey)

Goal: one clear view of which ideas belong to which kind of text.

- [x] The lead view is the concept × corpus heatmap in times-chance, sorted, with the four leaders annotated.
- [x] The journey opens on a strong concept (death or care), without "0 reviewed" or empty-domain lines.
- [x] Relations is a deep link, not a tab; the 93 % claim carries its language caveat; the Riksdag corpus is described as sampled; the `ai_act` domain bug is fixed.

## Replik (#replik, new)

Goal: the flagship politics product: 33 years of Riksdag debate, what parties talk about, who sets the agenda, and how they vote.

- [x] The page exists with its six sections and the debate-map explore block.
- [ ] Field-code keywords are gone from `story.json`; groups 1 and 6 are named or labelled.
- [x] Per-session topic shares are exported, or the sections that need them are scoped to what exists.
- [x] Every finding on the page (R1–R8) re-verified from its file; misleading or stale politics posts are hidden.

## IT Incident Clustering (#thesis)

Goal: a finished visual case study of the degree project.

- [x] A hero row with three figures, the 121-cluster grid with its funnel, and the data-quality strip (thesis-1 to thesis-3).
- [x] Bilingual copy restored (thesis-4); counts consistent (thesis-5); the unsupported root-cause claim removed.

## Drug Synergy Lab (#drugcomb)

Goal: an honest, leakage-aware ML study that leads with the hard question.

- [x] No TensorFlow or deep-learning claim (drugcomb-1).
- [x] The default split is unseen drug pair (drugcomb-2); row counts consistent and the in-repo tree labelled as its own model (drugcomb-3); the monotherapy caveat is clear (drugcomb-4).
- [x] Phone chart labels, the empty silhouette flash and the legend typos fixed.

## Homie API (#homie)

Goal: a clean, contract-first backend that reads as well engineered.

- [x] Copy leads with what is built: 16 operations, 4 implemented, CI passing on PostgreSQL 16, with a link to the run (homie-1, homie-2, homie-5).
- [x] The figure is a correct data-model drawing that fits on a phone (homie-3, homie-4).
- [ ] Optional: households, tasks and completions routes implemented (homie-7), after which "in progress" can go.

## Project pages

- [ ] Each product has a page built from its canvas sketch ("Projects" page of the Intro sketches canvas) and its review's project-page content, in the shared template.
