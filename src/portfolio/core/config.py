"""Where everything lives, decided once.

Scripts used to compute `ROOT = Path(__file__).resolve().parents[N]` themselves (about 110
times), where N meant the repository in some files and platform/ in others, and read
PORTFOLIO_DB / PORTFOLIO_FEATURES in 35 and 14 places. The environment variables keep their
meaning; their defaults are the same paths the scripts used.
"""
import os
from pathlib import Path


def _repository() -> Path:
    """The checkout this package runs from: the nearest parent holding platform/pipeline.yml.

    Found by walking up rather than by a fixed parents[N], so it holds wherever this file sits;
    PORTFOLIO_ROOT overrides it for an install outside the checkout.
    """
    if root := os.environ.get("PORTFOLIO_ROOT"):
        return Path(root).resolve()
    for start in (Path(__file__).resolve(), Path.cwd().resolve()):
        for folder in (start, *start.parents):
            if (folder / "platform" / "pipeline.yml").is_file():
                return folder
    raise RuntimeError("Not inside the portfolio checkout; set PORTFOLIO_ROOT")


def _env_path(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, default))


ROOT = _repository()
PLATFORM = ROOT / "platform"
PUBLIC = ROOT / "frontend/public/data"
WAREHOUSE = ROOT / "warehouse"
DATABASE = _env_path("PORTFOLIO_DB", WAREHOUSE / "portfolio.duckdb")
RAW = _env_path("PORTFOLIO_RAW", WAREHOUSE / "raw")
FEATURES = _env_path("PORTFOLIO_FEATURES", WAREHOUSE / "features")
CLUSTER_LAB = _env_path("PORTFOLIO_CLUSTER_LAB", WAREHOUSE / "cluster_lab")


def load_env(path: Path | None = None) -> None:
    """Read ROOT/.env into the environment without overriding what is already set.

    Tolerates spaces around '=', quoted values, comments and 'export ' prefixes. Real
    environment variables win, so CI secrets are never shadowed by a stale local file.
    """
    path = path or ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip().removeprefix("export ").strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name, value = name.strip(), value.strip().strip("\"'")
        if name and value and name not in os.environ:
            os.environ[name] = value
