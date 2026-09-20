import sys
from pathlib import Path
from http.server import HTTPServer
sys.path.insert(0, str(Path(__file__).parent))
from index import handler
if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"API server on http://localhost:{port}")
    HTTPServer(("0.0.0.0", port), handler).serve_forever()
