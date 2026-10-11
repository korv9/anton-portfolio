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
