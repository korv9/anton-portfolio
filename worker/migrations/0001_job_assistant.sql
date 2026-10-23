-- The job assistant's owner records (worker/jobs.ts). One row per kind and key; value is JSON.
create table if not exists records (
    kind text not null check (kind in ('cv', 'draft', 'version', 'review', 'label')),
    key text not null,
    value text not null,
    updated_at text not null,
    primary key (kind, key)
);
