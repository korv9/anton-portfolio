"""Moved to portfolio.publish.dq_gate (docs/package.md). This path stays until the clean-up step so
pipeline.yml, the workflows and old imports keep working; the alias makes it the same module."""
import sys

from portfolio.publish import dq_gate as _moved

sys.modules[__name__] = _moved
