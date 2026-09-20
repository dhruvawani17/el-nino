"""
Local dev server for the API.
Run: python3 api/serve_local.py
Serves on http://localhost:8000
"""
import sys
from pathlib import Path
from http.server import HTTPServer

sys.path.insert(0, str(Path(__file__).parent))
from index import handler  # noqa: E402

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = HTTPServer(("0.0.0.0", port), handler)
    print(f"API server running on http://localhost:{port}")
    server.serve_forever()
