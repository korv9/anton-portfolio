"""Check local prerequisites without installing or deleting anything."""
import argparse
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GIB = 1024 ** 3
MIN_FREE = {'quick': 2, 'full': 4, 'delivery': 4}


def check(level, root=ROOT):
    free = shutil.disk_usage(root).free / GIB
    if free < MIN_FREE[level]:
        raise RuntimeError(f'{free:.1f} GiB free; {level} requires {MIN_FREE[level]} GiB. '
                           'Free space before retrying; no files were removed.')
    for command in ('git', 'node'):
        if not shutil.which(command):
            raise RuntimeError(f'{command} is unavailable on PATH')
    if not (root / 'node_modules/typescript/bin/tsc').is_file():
        raise RuntimeError('Dependencies are missing. Request installation or use an existing '
                           'installation with the same package-lock.json.')
    status = subprocess.run(['git', 'status', '--porcelain=v1', '-uno'], cwd=root,
                            capture_output=True, text=True, check=True)
    print(f'Preflight: {free:.1f} GiB free; {len(status.stdout.splitlines())} changed tracked paths; '
          'local browser workers default to 1.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--level', choices=MIN_FREE, default='quick')
    args = parser.parse_args()
    try:
        check(args.level)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Preflight failed: {error}\n')


if __name__ == '__main__':
    main()
