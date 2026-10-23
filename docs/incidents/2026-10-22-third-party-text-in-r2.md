# 2026-10-22/23: third-party text pushed to the public R2 bucket

## Summary

The R2 bucket that stores the warehouse is public, so anything pushed to it is
redistributed. Whole-tree pushes with `platform/publish/warehouse_store.py push` uploaded
raw files for the moral-foundation study that the project may not redistribute: Reddit
comments from MFRC, the GPL-3.0 eMFD dictionary and the ETHICS scenarios. A later push
uploaded a sample of Riksdag passages that had been written under `warehouse/features/`.
The files were deleted from the bucket, and the push code now refuses to upload those
folders.

## Impact

- Third-party text sat in a public bucket for a period that the repository does not
  record. MFRC is user text from Reddit; eMFD is GPL-3.0, whose terms the bucket did not
  meet; ETHICS was raw scenario text.
- The Riksdag passages are public records, but the sample was a model working file. The
  project's rule is that text working files are not published, and the docs said they were
  not.
- The site and the published releases did not contain any of this text. Only figures and
  derived features are published for the study.

## Timeline

Times are CEST, from commit timestamps.

| Time | Event |
|---|---|
| 2026-10-22 22:24 | `6d0f9415` pre-registers the study. Raw files go to `warehouse/raw/philosophy_moral`. |
| 2026-10-22 23:12 | `54170b4a` and `8f83cfc0` fit the tagger, draw the Riksdag passages into `warehouse/features/philosophy/moral/run` and publish the agreement figures. The whole-tree pushes that followed uploaded both folders. |
| 2026-10-23 01:00 | `f74866f1` adds `LOCAL_ONLY_RAW = ("philosophy_moral",)` to `warehouse_store.py` and a test that fails if that folder is pushed. The raw files were deleted from the bucket. |
| 2026-10-23 13:24 | `f4c89710` moves the passage sample to `warehouse/ml/moral/run`, replaces the list with a per-tree `LOCAL_ONLY` that also covers `features/philosophy/moral/run`, and adds a test for it. The sample was deleted from the bucket. |

Both fixes are on branch `korv9/philosophy-moral`, in
[PR #104](https://github.com/korv9/anton-portfolio/pull/104), which was open against `loop`
when this was written. The deletions were done by hand with the bucket credentials; no
command in the repository records them.

## Root cause

`warehouse_store.py push` uploads a whole tree (`raw`, `features`, `cluster_lab`) unless it
is given `--path`. It had no list of folders to keep back, so any file placed under
`warehouse/raw/` or `warehouse/features/` was published on the next push. Nothing checked
the licence of a raw source before upload, and the passage sample was written under
`features/`, which is pushed whole.

## Fix

1. Deleted the MFRC, eMFD and ETHICS raw files and the Riksdag passage sample from the
   bucket.
2. `LOCAL_ONLY` in `platform/publish/warehouse_store.py` (on PR #104):
   `{"raw": ("philosophy_moral",), "features": ("philosophy/moral/run",)}`. `push_tree`
   drops every file under those folders before upload.
3. Two tests in `platform/tests/python/test_warehouse_store.py` (on PR #104):
   `test_third_party_text_kept_local_is_never_pushed` and
   `test_a_full_features_push_leaves_the_text_sample_behind`. Both create the files, push
   the whole tree and the folder by name, and assert that no key for them reaches the
   bucket.
4. The passage sample now lives in `warehouse/ml/moral/run`, which no push reads.

## Prevention

- Before any push, list what will be uploaded.
- Push third-party raw text only when its licence allows redistribution, and then with its
  licence or attribution file next to it. Otherwise keep the raw files local and push only
  counts and derived features. Add the folder to `LOCAL_ONLY` with a test.
- Keep text working files (samples, passages, model inputs) out of `warehouse/features/`.
  Use a local-only folder such as `warehouse/ml/`.
