"""SQLite status ledger plus an OS-held, crash-safe single-writer lock."""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3

from .io import atomic_json, now

STATES={'pending','running','completed','failed','interrupted'}


class Registry:
    def __init__(self,root):
        self.root=Path(root)
        self.root.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(self.root/'registry.sqlite',timeout=30)
        self.db.execute('pragma journal_mode=WAL')
        self.db.execute('create table if not exists entries (id text primary key, kind text, status text, body text)')
        self.db.commit()

    @contextmanager
    def writer(self):
        path=self.root/'writer.lock'
        stream=path.open('a+b')
        if stream.tell()==0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except (OSError,IOError) as error:
            stream.close()
            raise RuntimeError(f'Another process holds {path}; inspect status before starting a writer') from error
        atomic_json(self.root/'writer.json',{'pid':os.getpid(),'started_at':now()})
        # A dead process's running records become resumable, never pretend completed.
        for row in self.rows():
            if row['status']=='running':
                self.put(row['id'],row['kind'],'interrupted',{**row,'error':'Previous writer exited before completion'})
        try:
            yield self
        finally:
            atomic_json(self.root/'writer.json',{'pid':None,'released_at':now()})
            stream.close()

    def put(self,id,kind,status,body):
        if status not in STATES:
            raise ValueError(f'Unknown state {status}')
        previous=self.get(id)
        if previous and previous['status']=='completed':
            if status!='completed':
                raise ValueError('Completed results are immutable')
            return previous
        entry={**body,'id':id,'kind':kind,'status':status,'updated_at':now()}
        self.db.execute('insert or replace into entries values (?,?,?,?)',
                        [id,kind,status,json.dumps(entry,default=str)])
        self.db.commit()
        return entry

    def get(self,id):
        row=self.db.execute('select body from entries where id=?',[id]).fetchone()
        return json.loads(row[0]) if row else None

    def rows(self,kind=None):
        query='select body from entries'
        rows=self.db.execute(query+(' where kind=?' if kind else ''),[kind] if kind else []).fetchall()
        return [json.loads(row[0]) for row in rows]

    def close(self):
        self.db.close()
