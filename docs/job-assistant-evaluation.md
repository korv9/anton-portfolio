# Arbetsförmedla match evaluation, 2026-10-27

## Method

- Judged by an AI agent (Claude) on behalf of the owner, not by the owner. Labels are a reading of
  the ad text against the approved profile `tmp/ja/versions/v1.json` (wishes Stockholm/Solna/Sundbyberg
  or remote; data engineering, analytics engineering, applied AI, Python backend first; junior with two
  LIA internships and YH AI Developer education). Formal education requirements were ignored.
- Inputs: `frontend/public/data/job-assistant/matches.json` (2,196 matches: 4 strong, 32 possible,
  145 stretch, 2,015 outside), `ads.json`, full text from `warehouse/raw/job_assistant/ads.json`.
- Population: open, non-duplicate, not removed ads with a match row (2,196). Sorted by id, then
  `random.Random(20261027)`: 6 from strong+possible, 8 from stretch, 8 from outside whose headline or
  occupation matches `data|analy|python|\bai\b|bi\b|utvecklare|developer|engineer|machine|ml\b|backend|fullstack|power bi|statisti`
  (1,128 candidates), 8 from the remaining outside ads.
- Each ad was read and labelled in a shuffled order before its class was looked at.
  `relevant` = apply now; `maybe` = worth a look, one clear obstacle; `not_relevant`.
- Script: session scratchpad `sample.py` (not in the repo). Rule causes were confirmed by re-running
  `match.match()` on the ad with v1.

## Sample

| id | headline | employer | place | system | label | reason (quote from the ad) |
| --- | --- | --- | --- | --- | --- | --- |
| 31561459 | Analyst to Protector Försäkring | MultiMind Holding AB | Stockholm | possible | not_relevant | "Fluent Spanish and English, both written and spoken" |
| 31429441 | AI Engineer | SAVR AB | Stockholm | possible | maybe | RAG/Python fits, but "4+ years of professional team-based software development experience" |
| 31555420 | AI Engineer | Swedbank AB | Stockholm | possible | relevant | "Design and prototype AI-driven solutions"; Azure OpenAI; no years asked |
| 31581790 | Junior analytiker inom Cyberhot | Försvarets Radioanstalt | Stockholm | possible | not_relevant | cyber threat work: "Analysera angrepp och andra företeelser i cyberdomänen"; Python only a merit |
| 31640268 | Junior mjukvaruutvecklare C++/Python | Friday Väst AB | Stockholm (Täby office) | possible | maybe | junior, Python and AI, but "Har goda kunskaper i C++" for sensor systems |
| 31582809 | Analytiker till Protector Försäkring | MultiMind Holding AB | Stockholm | possible | maybe | entry analyst, "Excel, SQL, R och Python"; insurance pricing rather than data work |
| 31511497 | Lead Full Stack Engineer | Friday Väst AB | Göteborg | stretch | not_relevant | "gedigen flerårig erfarenhet av fullstackutveckling", lead role |
| 31573398 | Junior IT-Support / Servicedesk | Asta Agency AB | Stockholm | stretch | not_relevant | support: "Office 365, MS Office, Windows" |
| 31429056 | Software Engineer - Backend | SAVR AB | Stockholm | stretch | not_relevant | "Have 5+ years professional software development experience" |
| 31444465 | Full-Stack Developer | Keystone Education Group AB | Stockholm | stretch | not_relevant | "5+ years of experience as a full-stack developer", React |
| 31637259 | Backend Developer (TypeScript) | Qred Bank AB | Stockholm | stretch | not_relevant | "Several years of professional experience in backend software engineering with Typescript" |
| 31622304 | Scientist inom dataanalys och programmering | Academic Work Sweden AB | Uppsala | stretch | not_relevant | Uppsala on site, "framför allt i R" |
| 31649960 | Senior UX Researcher | Sway Sourcing Sweden AB | Stockholm | stretch | not_relevant | "Omfattande erfarenhet av UX Research" |
| 31457771 | Lead Service Designer | Volumental AB | Stockholm | stretch | not_relevant | service design lead, not development |
| 31513736 | .NET-utvecklare | Knightec Group | Göteborg | outside | not_relevant | "minst fyra års erfarenhet av utveckling i C#/.NET" |
| 31630875 | Senior IT-tekniker | Post- och Telestyrelsen | Sundsvall | outside | not_relevant | user IT support in Sundsvall |
| 31575734 | Linuxspecialist | Norrköpings kommun | Norrköping | outside | not_relevant | Linux operations, Norrköping |
| 31644971 | Senior DevOps Engineer | Techrytera AB | Göteborg | outside | not_relevant | ">5 years of hands-on DevOps / CI/CD experience" |
| 31565662 | Fullstackutvecklare | Getdig AB | Norrköping | outside | not_relevant | Norrköping, "Professionell erfarenhet av fullstackutveckling" |
| 31583142 | DBA | Synteda AB | Göteborg | outside | not_relevant | "Flera års erfarenhet av databashantering", Göteborg |
| 31618711 | Informationssäkerhetssamordnare | Stockholms kommun | Stockholm | outside | not_relevant | information security governance |
| 31553513 | Teknisk underrättelseanalytiker | Försvarets Radioanstalt | Stockholm | outside | maybe | "God erfarenhet av programmering med Python", "Arbeta med komplexa datamängder"; but "Minst tre år inom IT" |
| 31532763 | Modern Workplace & AI Konsult | Compago AB | Göteborg | outside | not_relevant | M365/SharePoint in Malmö or Göteborg |
| 31595738 | Senior IMS-specialist | Quest Consulting | Sundbyberg | outside | not_relevant | mainframe "IMS, z/OS, TSO/ISPF, COBOL" |
| 31633383 | Senior Frontendutvecklare | Quest Consulting | Malmö | outside | not_relevant | Vue frontend, Malmö |
| 31564899 | Frontend Team Lead Simulation Software | Comsol AB | Stockholm | outside | not_relevant | "experienced software engineer", team lead |
| 31582331 | Platform Engineer / DevOps Engineer | Logikfabriken AB | Linköping | outside | not_relevant | "5+ years of relevant experience in Platform Engineering" |
| 31512343 | Senior UX Designer / Frontendutvecklare | Knowit | Malmö | outside | not_relevant | senior UX consultant |
| 31547612 | Mjukvaruutvecklare inom VHDL | Friday Väst AB | Göteborg | outside | not_relevant | "VHDL och FPGA", Göteborg |
| 31574567 | Erfaren fullstackutvecklare | E-Hälsomyndigheten | Stockholm | outside | not_relevant | "flerårig aktuell arbetslivserfarenhet av backend-utveckling i Java" |

## Metrics

| Measure | Count |
| --- | --- |
| List precision (relevant or maybe among strong+possible in the sample) | 4 of 6 (1 relevant, 3 maybe) |
| Relevant ads not on the list (stretch+outside) | 0 of 24 |
| Maybe ads not on the list | 1 of 24 (outside, 31553513) |
| Stretch ads judged not_relevant | 8 of 8 |
| Outside ads judged not_relevant: plausible-title stratum / random stratum | 7 of 8 / 8 of 8 |

The sample is small; the shown-list count (6) cannot separate a 50 % from a 90 % precision. Checks run
across all 36 shown ads (not sampled) are in the causes below.

## Disagreements and rule causes

1. 31561459 Analyst (Spanish), possible, label not_relevant. "Fluent Spanish" is not a condition: the
   language rule only knows Swedish and English (`platform/publish/job_content.py:147`), so no check row
   and no flag. Class came from `\banalyst\b` (`match.py:38`).
2. 31581790 Junior analytiker inom Cyberhot, possible, label not_relevant. `\banalytiker\b`
   (`match.py:38`) reads any "analytiker" title as data analysis; the skills are only Python and Linux,
   both `ambiguous`, so one practical skill gives 50 %.
3. 31553513 Teknisk underrättelseanalytiker, outside, label maybe. Three causes: `\banalytiker\b` does
   not match the compound "underrättelseanalytiker", so role is `other` (`match.py:38`); the Python
   requirement under "Vi ser att du passar bra i rollen om du har:" stays `ambiguous` because only
   krav/requirements headings set strength (`job_content.py:133-136`); and C#, C++, Java under "Det är
   ett plus om du har ..." become `required` because "du har" matches REQUIRED (`job_content.py:39`)
   and PREFERRED lacks "ett plus" (`job_content.py:38`). "Minst tre år" in words is also not read as
   years (`match.py:46`).
4. 31429441 AI Engineer (SAVR), possible, label maybe. "4+ years of professional team-based software
   development experience" is not read: YEARS allows at most two plain words between "years of" and
   "experience" and none with a hyphen (`match.py:46`). With it, the ad would be stretch.

Rule errors in the sample that did not change the shown/not-shown outcome:

- 31429056 SAVR backend: "5+ years professional software development experience" missed (three words
  in between, `match.py:46`). 31637259 Qred: "Several years" has no digit (`match.py:46`).
- 31637259 "Backend Developer (TypeScript)" is `python_backend`: `back.?end` alone names the role
  (`match.py:39`).
- 31573398 Junior IT-Support and 31649960 Senior UX Researcher are `applied_ai` from the body: the first
  600 characters say "data, AI, molntjänster" (`match.py:56` with `\bai\b`, `match.py:36`).
- 31622304 Uppsala and 31511497 Göteborg reach stretch only through REMOTE: "möjlighet att arbeta
  hemifrån när arbetsuppgifterna tillåter det" is hybrid wording (`match.py:48`, `match.py:120-123`).
- 31630875, 31575734, 31574567 are marked "remote work mentioned" for "möjlighet till distansarbete",
  "delvis" and "delvis på distans".

Same causes measured on all 36 shown ads:

- Years: 6 of 36 state a number of 3 or more that YEARS missed ("At least 5 years of hands-on
  experience", "Minst 4 års aktuell och relevant erfarenhet", "Minst 4 års arbete", "5+ years in
  corporate ... security", "minst fem år", SAVR above). 4 more say "flerårig" or "flera års".
- Place: 4 of 36 (1 strong, 3 possible) are outside the wished places and pass only on REMOTE wording.
  The strong one, 31586384 BI utvecklare i Ulricehamn (rank 4), passes on "möjlighet att arbeta på
  distans en dag i veckan". 25 of 145 stretch ads pass the same way, including one that says "Remote
  work is not available." (negation not handled).
- Role from the body only: 9 of 36 shown ads, among them "Security Engineer, Corporate", "Konsult inom
  Azure Security", "IT Engineer & Support Specialist" (applied_ai) and "We are looking for a C#.NET
  developer!" (python_backend).

## Traceability spot-check (3 judgements)

| Match / skill | Ad quote verbatim in ad | CV quotes verbatim in CV |
| --- | --- | --- |
| 31555420 Azure | yes (line 26) | project and skills quotes yes; the practical quote no |
| 31582809 Python | yes (lines 16, 22) | project quotes yes; the practical quote no |
| 31429441 data modeling | yes (line 50) | skills quote yes; practical and project quotes no |

The content of each failing CV quote is in the CV, but line-end commas are gone ("covering tickets
problems" for "covering tickets,\nproblems") and the entry heading is glued in front ("LIA internship ·
Freshservice ITSM data in Azure Databricks Built a ..."). Cause: `clean_lines` strips "," from each line
end (`platform/job_assistant/cv.py:79`) and `sentences` joins lines without a period break
(`cv.py:98-100`). The quotes are traceable by eye but fail an exact substring test.

## Recommended rule fixes, by impact

1. Years (`match.py:46`): allow up to about six words, hyphens and "of hands-on" between the number and
   experience/erfarenhet/arbete; read Swedish and English number words; treat "flerårig", "flera års",
   "several years" as 3+. Moves at least 6 of 36 shown ads to stretch.
2. Remote (`match.py:48`, `120-123`): count only full-remote wording ("helt på distans", "100 %
   distans", "fully remote", "remote-first"); drop "möjlighet till distansarbete", "delvis", "X dagar i
   veckan", "hybrid", and negations ("not available", "inte möjligt"). Removes 4 shown and up to 25
   stretch ads from other cities, including the strong Ulricehamn ad.
3. Body-only roles (`match.py:56`): a role found only in the body should not make an ad possible; cap
   it at stretch or require a role word near "du kommer"/"you will". `\bai\b` in company boilerplate is
   the main source. Affects 9 of 36 shown ads.
4. Role patterns (`match.py:38-39`): `python_backend` should need Python in title or required skills,
   not "backend" alone; `data_analysis` from "analytiker/analyst" should need data, SQL or statistics in
   the requirements, and match compounds (`\w*analytiker\b`) only with that context.
5. Requirement strength and conditions (`job_content.py:38-39`, `133-136`, `147`): add "ett plus" to
   PREFERRED; let a heading like "Det är ett plus om ..." or "Meriterande" outrank "du har" in the lines
   under it; treat "Vi söker dig som har:"/"om du har:" headings as required; add a general language
   condition (`(flytande|fluent) \w+ (and|och)` or a language list). Also keep commas in CV lines
   (`cv.py:79`) so CV quotes are verbatim.

## Round 2 (job-match-v3)

### Method

- Same judge (an AI agent on behalf of the owner), same date (2026-10-27), same label meanings.
  Engine `job-match-v3`, profile version 2, current `frontend/public/data/job-assistant/*.json`:
  2 strong, 11 possible, 96 stretch, 2,087 outside (2,196 matches).
- Judged: all 13 strong+possible; all 24 ads shown under v1 and no longer shown (the coordinator's
  note said 23; the v1 list had 36 and 12 of them are still shown, so 24 dropped); a new sample with
  `random.Random(20261028)` over the id-sorted open population: 10 stretch, 15 outside matching
  `data|analy|python|\bai\b|\bml\b|machine|\bbi\b|dbt|utvecklare|developer|engineer` (1,185 candidates),
  10 other outside. 72 distinct ads, read in a shuffled order and labelled before the classes were opened.

### Shown list (13)

| id | headline | place | v3 | label | reason |
| --- | --- | --- | --- | --- | --- |
| 31585265 | Data Engineer inom Semantisk Datahantering | Stockholm | strong | relevant | "strukturera och organisera data från olika system och källor" |
| 31650547 | Konsult / Interim Data Engineer / BI | Stockholm | strong | not_relevant | interim consultant "med din expertis och erfarenhet" |
| 31552681 | Associate Forward Deployed AI Scientist (Nordea) | Stockholm | possible | relevant | "Graduate / Junior Data Scientist, at the start of their tech career" |
| 31555420 | AI Engineer (Swedbank) | Stockholm | possible | relevant | "Design and prototype AI-driven solutions"; no years |
| 31409235 | Analytics Engineer in-house (Netlight) | Stockholm | possible | maybe | top role, but "At least 2+ years of relevant experience" |
| 31576808 | Dataanalytiker (Riksrevisionen) | Stockholm | possible | maybe | "Stata, R eller Python", social-science analysis |
| 31582809 | Analytiker till Protector Försäkring | Stockholm | possible | maybe | "Excel, SQL, R och Python"; insurance pricing |
| 31591629 | Dataanalytiker (Utbetalningsmyndigheten) | Stockholm | possible | maybe | "Minst två års ... SQL" |
| 31640268 | Junior mjukvaruutvecklare C++/Python | Stockholm | possible | maybe | junior, Python, but "goda kunskaper i C++" |
| 31641894 | Teknisk underrättelseanalytiker (FRA) | Stockholm | possible | maybe | Python, "mängddata/metadata ... genom studier"; signals focus |
| 31561459 | Analyst to Protector Försäkring | Stockholm | possible | not_relevant | "Fluent Spanish" (now a check row, by design) |
| 31612937 | M365-specialist med AI-fokus (Coor) | Solna | possible | not_relevant | "flera (5+) års erfarenhet av administration ... Microsoft 365" |
| 31652104 | Concepts Researcher: AI in 6G RAN | Stockholm | possible | not_relevant | "Strong technical leadership skills", RL research |

### Dropped since v1 (24)

| id | headline | v3 | label | rightly dropped? |
| --- | --- | --- | --- | --- |
| 31643610 | SYSTEMUTVECKLARE VID MUST | outside | relevant | no: "Erfarenhet av programmering i Python", "Databasmodellering och bearbetning av dataflöden" |
| 31626862 | Data Engineer till Saint-Gobain | stretch | maybe | yes by the rule: "Flera års erfarenhet" counts as 3 |
| 31614367 | Data engineer (Skolverket) | stretch | maybe | yes by the rule: "erfaren", "flerårig" |
| 31429441 | AI Engineer (SAVR) | stretch | maybe | yes: "4+ years" |
| 31596630 | IT Engineer & Support Specialist (Carla) | outside | maybe | borderline: AI automations, 20 % support; role `other` |
| 31428566 | Utvecklare 4BrightRX | outside | maybe | no place given; "möjlighet till distansarbete" is not full remote |
| 31590883 | Mjukvaruutvecklare (SkillHuset) | stretch | maybe | role only from the body, capped at stretch |
| 31522192 | Deep Learning Engineer (Univrses) | stretch | maybe | title not read as ML; body-only cap |
| 31551762, 31586384, 31638207, 31606248, 31586623, 31634274, 31614461, 31592538, 31544088, 31429226, 31573561, 31628720, 31631313, 31581790, 31602644, 31634272 | 16 ads | stretch/outside | not_relevant | yes (5 years, Ulricehamn, Göteborg, product lead, security, C#, 4+ years ML/BI, cyber) |

### New sample (35)

| id | headline | place | v3 | label | reason |
| --- | --- | --- | --- | --- | --- |
| 31630216 | Data Engineer – grafdatabaser och AI | Solna | stretch | relevant | "Minst ett års relevant erfarenhet genom arbete, alternativ examensarbete" |
| 31645075 | AI Software Engineer Semantic Data & LLM | Stockholm | stretch | maybe | RAG, Python, SQL; "An experienced AI Software Engineer", 5 years read |
| 31645682 | Fullstackutvecklare (Quest) | Stockholm | stretch | maybe | "Python, FastAPI, PostgreSQL"; 5 years read |
| 31637257, 31628869, 31649960, 31462589, 31568760, 31457771, 31625553 | senior ServiceNow, senior LLM inference, senior UX, principal consultant, senior DE, lead service designer, PIM | Stockholm/Solna | stretch | not_relevant | senior titles or not development |
| 31422754 | Software Engineer (Legora) | Stockholm | outside | maybe | "engineer with experience building and shipping modern software products"; no years |
| 31648233, 31535736, 31581256, 31630977, 31571890, 31564834, 31461412, 31278702, 31563559, 31618766, 31606315, 31559961, 31564588, 31632254 | 14 plausible-title outside ads | various | outside | not_relevant | hardware, Pega, network, C++/Java/.NET, senior, other cities |
| 31526135, 31582169, 31476175, 31525270, 31576214, 31650664, 31500305, 31618540, 31558612, 31558369 | 10 random outside ads | various | outside | not_relevant | support, game C++, DevSecOps, security, other cities |

### Metrics

| Measure | v1 | v3 |
| --- | --- | --- |
| Shown ads judged relevant or maybe | 16 of 36 (4 relevant, 12 maybe; all 36 now judged) | 9 of 13 (3 relevant, 6 maybe) |
| Not_relevant ads on the list | 20 of 36 | 4 of 13 |
| Dropped v1 ads that were not_relevant | | 16 of 24 |
| Dropped v1 ads that were relevant or maybe | | 8 of 24 (1 relevant, 7 maybe; 3 of the maybes by the intended years rule) |
| New sample, stretch: relevant / maybe | | 1 / 2 of 10 |
| New sample, outside plausible: relevant / maybe | | 0 / 1 of 15 |
| New sample, outside random: relevant / maybe | | 0 / 0 of 10 |

v3 is better overall. The list shrinks from 36 to 13, not_relevant ads on it fall from 20 to 4,
and precision goes from 16 of 36 to 9 of 13. The cost: two relevant ads are now hidden (31643610
outside, 31630216 stretch) and four maybes are hidden by role or place rules rather than by years.

### Causes (v3)

Hidden relevant or maybe:

1. 31643610 Must, 31590883, 31422754: a generic developer title ("Systemutvecklare",
   "Mjukvaruutvecklare", "Software Engineer") names no role. `python_backend` needs "python" in the
   title or a required Python skill (`match.py:44`, `match.py:75-91`), and a body-only role is capped at
   stretch (`match.py:187`).
2. 31630216 Data Engineer grafdatabaser: none of its skills (ontologier, kunskapsgrafer, grafdatabaser,
   semantiska lager, datapipelines) is in the vocabulary (`skills.py:18-32`), so `share` is None and a
   title-read data-engineering ad asking "Minst ett års" can only be stretch (`match.py:187-190`).
3. 31522192 "Deep Learning Engineer": the ML pattern has no "deep learning" or "computer vision"
   (`match.py:40`).
4. 31428566: no municipality or region and no full-remote wording, so outside (`match.py:183-186`). An
   ad with no place could be shown as uncertain instead.

Still on the list but not_relevant:

5. 31612937: "flera (5+) års" is not read; the ")" between "+" and "års" breaks YEARS (`match.py:57`;
   `years_asked` returns [] for the sentence).
6. 31650547 (strong) and 31652104: senior wording outside the title ("med din expertis och
   erfarenhet", "Konsult / Interim", "Strong technical leadership skills") is not read; SENIOR is
   checked against the headline only (`match.py:47`, used at `match.py:178`).
7. 31561459 Spanish: now a check row, as designed; not a rule bug.

### Recommended next fixes, by impact

1. Read a generic developer title (`systemutvecklare|mjukvaruutvecklare|utvecklare|software engineer|developer`)
   as `python_backend` from the title when the ad requires Python, or as the data role when the
   requirements carry data context (`match.py:37-46`, `75-91`). Recovers 31643610 and 31590883.
2. Add graph, ontology, semantic-layer, knowledge-graph and data-pipeline terms to the vocabulary
   (`skills.py:18-32`), and let a title-read wished role with no named skill and at most 2 years asked
   be `possible` with an uncertainty note (`match.py:187-190`). Recovers 31630216.
3. Allow a closing bracket in YEARS (`match.py:57`) and add body seniority cues for consultancy and
   leadership wording (`match.py:47`). Removes 31612937, 31650547 and likely 31652104.
4. Add `deep learning|computer vision|djupinlärning` to the ML title pattern (`match.py:40`).

## After round 2 (job-match-v4)

The round 2 fixes were applied as `job-match-v4` on the same store and profile. Counts went from
2 strong, 11 possible, 96 stretch, 2,087 outside (v3) to 1, 18, 109, 2,068. The ads named in
round 2 moved as follows; the new list was not judged again.

| id | v3 | v4 | note |
| --- | --- | --- | --- |
| 31643610 Must, Systemutvecklare | outside | possible | generic developer title with Python named |
| 31590883 Mjukvaruutvecklare | outside | possible | same rule |
| 31428566 4BrightRX | outside | possible | no place stated; shown with that uncertainty |
| 31630216 Data Engineer, graph databases | stretch | stretch | the CV shows none of the three graph skills it names |
| 31522192 Deep Learning Engineer | outside | stretch | ML title read; 1 of 5 named skills practical |
| 31612937 M365 | possible | stretch | "flera (5+) års" read as 5 years |
| 31650547 Interim Data Engineer | strong | stretch | body asks for seniority |
| 31652104 6G RAN | possible | stretch | body asks for technical leadership |
| 31422754 Legora | outside | outside | the ad never names Python |
