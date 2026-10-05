# taLLMan

A source-critical chat about the Riksdag at `#tallman`. You ask a question. It retrieves passages, turns the answer into claims, and checks every claim against its sources with **Allegoria**. The answer comes back with its sources, a label per claim, a certainty level and a full trace ("Granska svaret").

```
question → retrieve (BM25, + vectors when bound) → claims (Claude, or the extractor) → Allegoria → answer + trace
```

It works today without any keys: lexical search, extractive claims, and the engine running in the browser or the Worker. Each part below switches on when you connect it.

## Files

| Part | Where |
|---|---|
| Search index (facts + debates) | `platform/tallman/build_index.py` → `frontend/public/data/tallman/index.json` (`npm run tallman:index`) |
| Reviewed change annotations | `frontend/public/data/tallman/annotations.json` (empty until reviewed) |
| Engine (pure TS: browser, Worker, Node) | `frontend/src/tallman/engine/`: `types`, `text` (BM25, Swedish numbers), `entities`, `retrieve`, `claims` (extractor, prompt, JSON schema), `allegoria`, `pipeline` |
| Worker API | `worker/index.ts`: `POST /api/tallman/ask`, `GET /api/tallman/status`, `POST /api/tallman/reindex` |
| Claude | `worker/llm.ts` (official `@anthropic-ai/sdk`) |
| Embeddings + vector search | `worker/vector.ts` (Workers AI `@cf/baai/bge-m3` + Vectorize, hybrid with BM25 by reciprocal rank fusion) |
| Page | `frontend/src/tallman/TallmanPage.tsx`, `client.ts` (asks the Worker, falls back to the browser) |
| Test questions and runner | `platform/tallman/eval/questions.json`, `run.ts` (`npm run tallman:eval`) |

## The index

The index holds two kinds of evidence, both built from data the site already publishes.

- **Datapoints** (640): recomputable facts, each with its numbers, a link on the site and the original source:
  - voting agreement between parties and each party's record per riksmöte, from 2018/19;
  - budget motions against the government's proposal, in total and per expenditure area for the last three years;
  - SCB party-sympathy surveys, the last four;
  - the latest election.
- **Debates** (1,370, riksmöten 2022/23–2025/26): title, date, parties speaking and frequent words.
  - The speeches themselves are read at answer time from their shards in R2.
  - A shard holds a whole protocol, so each debate records its range of speech numbers.

## Allegoria's labels

The model proposes each claim; Allegoria decides its label. No model is involved, so the same claim always gets the same label.

| Label | When |
|---|---|
| Direkt belagt | A quote found word for word in the cited passage, or figures the passage states |
| Beräknat | A number derived from the sources' values (a difference or sum), or a share the site's pipeline computed from the votes |
| Sammanfattning | The claim's content words are in its sources, but not word for word (≥ 50 % overlap) |
| Tolkning | Analytic wording ("tyder på", "strategi" …), or 20–50 % overlap |
| Otillräckligt underlag | No source; a quote or number the sources do not hold; or a claim of change over time (skärpt, lättat, mildrat …) without a reviewed annotation |
| Motstridiga källor | Two retrieved passages give different values for the same fact |

**Certainty** is set from the labels:

- **Hög:** no weak claims, and at least 60 % direct or computed.
- **Låg:** any conflict, or at least half the claims weak.
- **Medel:** otherwise, and always when the question asks about change over time and there is no annotation.

**Change over time is shown only with reviewed annotations.**

- Add one to `annotations.json` with `about` (passage ids), `direction`, `text`, `source`, `reviewed_by` and `reviewed_at`.
- Entries without a reviewer are ignored.

## Connecting a language model (Claude)

1. Create a key at console.anthropic.com. Keep it out of the repository and out of chats.
2. Store it as a Worker secret:
   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
   `LLM_API_KEY` is accepted as an alias.
3. Optional settings in `wrangler.toml` `[vars]`:
   - `LLM_MODEL`, default `claude-opus-5-5`;
   - `LLM_EFFORT`, default `medium`; `low` is cheaper, `high` is more careful.
4. Deploy. `GET /api/tallman/status` then shows `"llm": true`.

How the model is called:

- The model gets the passages as numbered `<källa>` blocks.
- It must answer in the JSON schema `CLAIMS_SCHEMA` (structured outputs).
- Adaptive thinking is on.
- **Server-side fallback is on** (`fallbacks: "default"`): if the model is overloaded, the API answers with its default fallback model. The trace records the model that actually answered.
- If the call fails, the answer is extractive and the trace says so.

Before making a key-backed endpoint public, uncomment the `[[ratelimits]]` block in `wrangler.toml` (10 questions per minute per visitor by default).

## Connecting embeddings and vector search

1. Create the index; bge-m3 has 1,024 dimensions:
   ```
   npx wrangler vectorize create tallman --dimensions=1024 --metric=cosine
   ```
2. Uncomment `[ai]` and `[[vectorize]]` (binding `VECTORS`, index `tallman`) in `wrangler.toml` and deploy.
3. Set an admin token and fill the index. The route embeds one slice per call, so no call runs into the Worker's limits:
   ```
   npx wrangler secret put ADMIN_TOKEN
   TALLMAN_URL=https://anton-portfolio.anton-ernstson.workers.dev ADMIN_TOKEN=… node scripts/tallman-reindex.mjs
   ```
4. `/api/tallman/status` now shows `"vectors": true`. Retrieval becomes hybrid: BM25 and vectors, merged by reciprocal rank fusion. The trace shows which retriever found each passage.

**Using another vector store or embedding model.** Implement the `Retriever` interface (`retrieve(question) → Passage[]`) in `frontend/src/tallman/engine/retrieve.ts` and add it to the `HybridRetriever`. The rest of the pipeline does not change.

**After the data is rebuilt:**

1. Run `npm run tallman:index`.
2. Run the reindex script again; upserts replace vectors with the same id.

## Measuring

```
npm run tallman:eval            # lexical, no model
ANTHROPIC_API_KEY=… npm run tallman:eval -- --llm
```

The runner writes `platform/tallman/eval/report-<mode>.json`. It reports:

- **Retrieval recall:** whether the expected passages or debates came back.
- **Source support:** the share of claims labelled direct, computed or summary; the share of interpretations; and the share without support.
- **Abstention:** whether the two unanswerable questions get no supported claims.
- **Change over time:** whether the two change questions avoid being answered as settled.

**Status of the 24 questions.**

- The expected sources were set from the index when the code was written. **No person has reviewed them yet** (`reviewed: false`).
- The retrieval rules were tuned while running these same questions. The extractive mode's 24/24 is therefore not an independent result.
- Extractive claims are near-copies of their sources, so their support share is high by construction.
- The informative numbers are:
  - `--llm` runs;
  - new questions written by someone else.
