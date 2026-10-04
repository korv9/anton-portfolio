# Swiss Data Editorial

`frontend/src/design-system.css` owns the tokens: warm ivory canvas (`#FAF8F3`), paper
(`#F2EFE7`), near-black text (`#0A0A0A`), quiet rules and a restrained categorical data palette.
Manrope is the primary typeface, self-hosted as a variable font (weights 200–800) and
preloaded. Its source is [Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope);
the SIL Open Font License is retained at `frontend/public/fonts/Manrope-OFL.txt`.
Body copy, navigation, captions and tags use the same family. Numbers and selected
technical annotations use the system monospace stack. The display and heading scales are fluid; numerical
figures are tabular. Party identity continues to come from `parties/identity.tsx`.

The homepage spans the viewport, inset 20px on desktop and 12px on phones, without an
outer border. Its header is static and transparent, with a one-line name taking about
55% of desktop viewport width. Navigation, contact links and the CV sit below the introductory description; the separate About section is removed. On phones the
name takes most of the width, with language and menu controls below it.
Below the introductory copy and map, experience and projects share a full-width
two-column layout, with experience on the left and projects on the right. At widths
of 1,000px or less they stack in that reading order.
Report containers and the remaining homepage sections retain a 1,440px maximum.
Containers use 20–44px fluid gutters. Compact homepage project rows combine a number,
short description and tags over their real diagram previews. A pale overlay preserves
text contrast. These backgrounds are decorative and inert; project headings and details
provide the interactive links. Full problem/build/result descriptions remain available
in expandable details with an opaque reading surface.
The homepage h1 is the header name; the introduction begins with the professional
role as an h2. The map's points use real job-analysis coordinates;
quiet contours show Gaussian-smoothed density of those displayed points, not cluster
boundaries. Preview framing uses assigned-point bounds and can clip remote noise;
the linked explorer offers the full map. The visual reference's right-hand design
sheet is treated as guidance for the website, not an extra homepage panel.

`frontend/src/ui/Editorial.tsx` provides Container, Section, SectionHeader, Tag, Metric,
VisualizationFrame and ProjectRow. Existing report components continue to work with the
same tokens. Experience and four projects follow the name section together: politics,
tech jobs, the incident-clustering thesis and Allegoria. Welfare, DrugComb, Homie and other
projects remain linked in the expandable project list. Experience, skills, contact, CV
remain available in both languages. The former fullscreen name intro is no longer shown.

Decorative gradients, rounded KPI panels, shadows, chart drop shadows and hover lifts in
the global system were removed. Contradictory large radii/shadows in legacy styles were
removed at their source rather than masked by a universal `!important`. Circular logos
and data marks retain their shapes. Small controls can have modest radii; floating
tooltips may retain an unobtrusive separation shadow.

Charts use rules, whitespace and a reading hierarchy instead of a card around each
figure. Existing political colours are unchanged. Focus outlines, semantic headings,
labelled controls and reduced-motion rules are shared across products.

Politics uses one dot per parliamentary seat from the latest delivered election,
alongside the last ten calendar years of delivered SCB party-support observations.
Party colours remain unchanged. No incident UMAP or performance graph is fabricated:
that project uses a clearly labelled workflow illustration. Allegoria previews the
observed RFC requirement-category counts. Its detailed report continues to distinguish
observed and synthetic examples. Job previews render nothing in the hero when delivery
is absent. The actual project scope and routes are retained rather than copying the
reference image's example claims.

Typography references reviewed for the larger masthead: [Dennis Snellenberg](https://dennissnellenberg.com/)
and [Niccolò Miranda](https://www.niccolomiranda.com/). The emphasis is on a name that
sets the scale of the page, alongside compact supporting text.


Experience uses keyboard-operable disclosure buttons with horizontal duration bars
(Avtalat: Jan–Jun 2026, six calendar months; Fora: Nov 2025–Jan 2026, three).
The shared scale is 0–6 calendar months, including both named endpoint months;
these are period lengths, not skill scores. Avtalat opens initially. Animation
respects reduced-motion preferences. The fourth featured project is How is Sweden
doing?, with a decorative SCB preview sourced from welfare/headlines.json on a
shared 0–100 percentage scale; the title opens the full interactive report.


The homepage now opens with a compact introduction and a five-colour radial
navigation circle. Experience, projects, education, skills and contact appear only
when selected, in a scrollable panel beside the circle (below it on mobile).
Segments indicate navigation categories, not measured proficiency. Labelled native
buttons provide keyboard access to the same controls. Hash links preserve direct
access, browser history and closing back to the overview. Motion respects reduced
motion. The earlier full-page columns are replaced by this explorer.


All project routes use the same freestanding name masthead as the homepage,
including size, spacing, language controls and location. On project pages the
name is a home link rather than a second h1. A back-to-projects link replaces
the old global menu. The project canvas shares the ivory background and Manrope
headings; politics navigation uses a pale purple active state with dark text.
