"""Moved to portfolio.storage.rawstore (docs/package.md). This path stays until the clean-up step so
pipeline.yml, the workflows and old imports keep working; the alias makes it the same module."""
import sys

from portfolio.storage import rawstore as _moved

sys.modules[__name__] = _moved
