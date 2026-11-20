"""Kept only for platform/legacy/build_gold.py, whose sha256 gold/semantic-model.json pins
(validate_gold.py), so the builder cannot change without a gold rebuild. It is portfolio.core.io
under the old name; drop it, and delivery.py beside it, at the next gold rebuild."""
import sys

from portfolio.core import io as _moved

sys.modules[__name__] = _moved
