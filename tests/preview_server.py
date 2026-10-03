"""Serve a local player fixture; it never fetches YouTube or external assets."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse

root = Path(__file__).resolve().parent.parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def do_GET(self):
        if self.path.split('?')[0] == '/watch':
            self.path = '/tests/player.html'
        super().do_GET()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'Preview: http://127.0.0.1:{args.port}/watch?v=preview', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
