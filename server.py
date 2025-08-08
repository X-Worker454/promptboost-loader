#!/usr/bin/env python3
import http.server
import socketserver
import os
from pathlib import Path

# Change to the directory containing the extension files
os.chdir(Path(__file__).parent)

PORT = 5000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        # Serve the extension files
        if self.path == '/':
            self.path = '/manifest.json'
        return super().do_GET()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Extension files server running at http://localhost:{PORT}")
        print("You can download the extension files from this server for testing")
        print(f"Manifest: http://localhost:{PORT}/manifest.json")
        print(f"Options: http://localhost:{PORT}/options.html")
        print(f"Popup: http://localhost:{PORT}/popup.html")
        httpd.serve_forever()