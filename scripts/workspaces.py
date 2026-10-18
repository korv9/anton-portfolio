"""Report worktree retirement candidates. Never remove files or Git references."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(path, *args):
    return subprocess.run(['git', '-C', str(path), *args], capture_output=True,
                          text=True, check=True).stdout.strip()


def inventory(root=ROOT):
    result = []
    for block in git(root, 'worktree', 'list', '--porcelain').split('\n\n'):
        fields = dict(line.split(' ', 1) if ' ' in line else (line, '')
                      for line in block.splitlines())
        path = fields.get('worktree')
        if not path:
            continue
        branch = fields.get('branch', '').removeprefix('refs/heads/')
        dirty = bool(git(path, 'status', '--porcelain=v1', '--untracked-files=normal'))
        ignored = bool(git(path, 'ls-files', '--others', '--ignored',
                           '--exclude-standard', '--directory'))
        ancestor = subprocess.run(['git', '-C', path, 'merge-base', '--is-ancestor',
                                   'HEAD', 'origin/main'], capture_output=True)
        if ancestor.returncode not in (0, 1):
            raise RuntimeError(f'Cannot compare {path} with origin/main')
        merged = ancestor.returncode == 0
        current = Path(path).resolve() == root.resolve()
        candidate = not dirty and not ignored and merged and not current and branch != 'main' and 'locked' not in fields
        result.append({'path': path, 'branch': branch or 'detached', 'dirty': dirty,
                       'included_in_cached_origin_main': merged, 'current': current,
                       'ignored_local_files_present': ignored,
                       'review_for_retirement': candidate})
    return result


if __name__ == '__main__':
    print(json.dumps(inventory(), indent=2))
