# 2026-10-22: shared warehouse emptied by a worktree removal

## Summary

Removing a finished Git worktree with `git worktree remove --force` deleted the contents of
the shared local warehouse. The worktree's `warehouse/` folder was a Windows directory
junction pointing at that warehouse, and the removal deleted files through the junction.
The warehouse was restored from the copy in R2 and the missing parts were rebuilt.

## Impact

- The local warehouse used by every worktree on the machine was emptied: `portfolio.duckdb`,
  `sfs.duckdb`, `features/`, `raw/jobtech/cluster-corpus/` and `cluster_lab/`.
- Local dbt builds, exports, clustering fits and R2 pushes stopped until the restore was done.
- The public site was not affected. It reads files committed to Git and Parquet and shard
  files in R2, and neither depends on the local warehouse.
- No data was lost for good. Everything was either in R2 or could be rebuilt from public
  sources.

## Timeline

Times are CEST, from commit timestamps and the GitHub Actions log.

| Time (2026-10-22) | Event |
|---|---|
| before 20:55 | A worktree whose `warehouse/` and `node_modules/` were junctions was removed with `--force`. Only the `node_modules` junction had been unlinked first. The shared warehouse was emptied. |
| before 20:55 | The warehouse was pulled back from R2 with `python platform/publish/warehouse_store.py pull` (about 3.4 GB, as reported by the operator; no commit records the pull). The vector files and `sfs.duckdb` were rebuilt locally. |
| 20:55 | `312dbc5a` lets the `cluster-jobs` workflow rebuild the job-ad corpus straight into `raw/jobtech/cluster-corpus` in R2. The corpus had never been stored in R2. |
| 22:03 | `b881dd6d` stops a failed raw rebuild from being pushed and keeps the 2.5 GB corpus out of whole-tree pulls. |
| 22:11 | `7d29faea` refits all nine clusterings on the restored warehouse. The statistics match the fit log from before the incident. |
| 23:07 | Actions run [39849958955](https://github.com/korv9/anton-portfolio/actions/runs/39849958955) pushes the rebuilt corpus: `Raw files in jobtech/cluster-corpus: 153 on disk, 153 uploaded (2518 MB)`. |

## Root cause

Worktrees in this repository share large folders through junctions: `node_modules` points
at one installed copy and `warehouse` points at the one local warehouse. On Windows,
`git worktree remove --force` does not stop at a junction. It deletes the files in the
target folder as if they belonged to the worktree. The cleanup unlinked `node_modules` and
missed `warehouse`.

## Fix

1. Pulled the warehouse from R2 with `python platform/publish/warehouse_store.py pull`.
2. Rebuilt the parts that were never stored in R2: the vector files and `sfs.duckdb`
   locally, and the job-ad corpus (153 files, 2.5 GB) in GitHub Actions, where it is now
   stored in R2 as well.
3. Refit and re-exported the clusterings and checked them against the earlier fit log.

## Prevention

- Unlink every junction in a worktree before removing it. List them with
  `Get-ChildItem -Recurse -Attributes ReparsePoint -Depth 2`, remove each one with
  `cmd /c rmdir`, then check that the shared targets still exist.
- Never use force removal as cleanup. [docs/development.md](../development.md) says this
  and lists what to check before a worktree is removed.
- Keep anything that exists only locally pushed to R2 before cleanup. The job-ad corpus is
  now rebuilt and stored by the `cluster-jobs` workflow
  ([.github/workflows/cluster-jobs.yml](../../.github/workflows/cluster-jobs.yml)).
