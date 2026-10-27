"""Moved to portfolio.storage.delivery (docs/package.md). This path stays until the clean-up step so
pipeline.yml, the workflows and old imports keep working; the alias makes it the same module."""
import sys

from portfolio.storage import delivery as _moved

sys.modules[__name__] = _moved
