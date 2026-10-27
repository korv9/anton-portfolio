"""Moved to portfolio.storage.warehouse_store (docs/package.md). This path stays until the clean-up step so
pipeline.yml, the workflows and old imports keep working; the alias makes it the same module."""
import sys

from portfolio.storage import warehouse_store as _moved

if __name__ == "__main__":
    raise SystemExit(_moved.main())
sys.modules[__name__] = _moved
