# Site structure

The current project structure is documented in [project-restructure.md](project-restructure.md).
The shared header replaces the sidebar. Project grouping is defined in
`frontend/src/projects/projectRegistry.ts`; topic links are in `frontend/src/projects/topics.ts`.

The homepage contains the identity, profile, experience and project index. Each project has
its own entry page. Observatory entry pages link to themed analyses. Labs and engineering
projects retain section addresses for their reports. Individual documents and exploratory
readers remain separate views. Previous and next links follow the menu's group order.

Retired platform and project addresses resolve to the project index. Their pipelines and
shared data utilities remain available to the projects that use them.
