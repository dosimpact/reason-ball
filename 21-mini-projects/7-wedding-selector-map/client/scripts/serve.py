"""Serve only the standalone client, preserving the existing /client/ URL."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from urllib.parse import urlsplit, unquote
import argparse


class PublicFilesHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if any(part.startswith('.') for part in path.split('/') if part):
            self.send_error(404)
            return None
        original = self.path
        if path == '/client':
            self.send_response(302)
            self.send_header('Location', '/client/')
            self.end_headers()
            return None
        if self.path.startswith('/client/'):
            self.path = self.path[len('/client'):]
        try:
            return super().send_head()
        finally:
            self.path = original


parser = argparse.ArgumentParser(description='Serve the standalone Wedding Atlas client')
parser.add_argument('--port', type=int, default=3077)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
handler = partial(PublicFilesHandler, directory=str(root))
server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
print(f'Wedding Atlas: http://127.0.0.1:{args.port}/client/', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
