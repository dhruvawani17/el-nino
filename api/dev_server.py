"""
Local development server — wraps the Vercel handler for uvicorn.
Only used during local development; Vercel uses api/index.py directly.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from index import handler  # noqa: E402

# Expose handler for uvicorn
__all__ = ["handler"]
