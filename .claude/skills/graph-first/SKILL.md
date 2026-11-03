---
name: graph-first
description: Consult the existing repository knowledge graph before source lookup for coding tasks, debugging, reviews, architecture questions, and data-flow investigations. Applies alongside the other repository skills.
---

# Read the graph first

Always consult the existing graph before searching or reading repository source.
Read required agent instructions first, then use this workflow even when the user
does not mention Graphify. Pass this rule to any delegated agent.

1. From the repository root, check for `graphify-out/graph.json`. It currently maps
   `platform` and `frontend`, including shared data artifacts.
2. Query the relevant function, component, model, or artifact with
   `graphify query "<symbol or topic>" --budget 1000`. Use the graph's actual names;
   resolve translated or ambiguous wording locally and return only relevant matches.
   For a known artifact or symbol, `graphify explain "<name>"` may be more precise.
3. Use the returned source paths and line locations to read only the code needed
   for the task. Verify behavior and proposed edits against current source.
4. If the result is truncated or vague, narrow the query before increasing its
   budget. Use `graphify path "<A>" "<B>" --undirected` for a specific connection.
5. If the graph is missing, inaccessible, stale, or lacks the needed information,
   state the limitation and use a targeted source lookup. Absence from the graph
   does not prove that a file, dependency, or behavior is absent from the repository.

Keep the existing graph between tasks. Run extraction or a rebuild only when the
user requests it. Do not load the full graph JSON, report, vocabulary, or unrelated
source files into model context. Let the local CLI read the graph and return a
small result. Treat `INFERRED` and `AMBIGUOUS` edges as leads to verify in source.

Instruction/configuration edits, Git status checks, and test execution can proceed
directly; source investigation within those tasks still starts with the graph.

The graph is a navigation index. Correctness checks and the other repository
skills still apply after it identifies the relevant code.

## Exploring connections

When the task is to find reuse, duplication or combinations across projects, data sources or
methods, the graph is the index and the source is the evidence. Mark every statement:

1. **Observed**: what the graph returned (edge, path, shared artifact), with the query.
2. **Verified**: the connection confirmed in source, with file and line.
3. **Hypothesis**: what the connection could mean for the product, stated as a question.
4. **Experiment**: the smallest check that would show whether it is worth doing.

Give at most three alternatives, each with its evidence, the use it would serve, the strongest
objection and that smallest experiment. Graph proximity proves navigation, not usefulness,
semantic likeness or cause. Decisions and intentions are not in the graph: read `PROJECTS.md`
and `docs/idea-lineage/<project>.md` for those. Write the alternatives as `Idé:` lines so they
enter the journal as proposed, never as decisions.
