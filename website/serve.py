#!/usr/bin/env python3
"""
Simple HTTP server for TableMoins website
Serves the landing page locally for testing
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 8000
DIRECTORY = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add cache control headers for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Custom colored logging
        message = format % args
        if "GET / " in message or "GET /index.html" in message:
            print(f"\033[92m✅ {message}\033[0m")
        elif "404" in message:
            print(f"\033[91m❌ {message}\033[0m")
        else:
            print(f"\033[94m📄 {message}\033[0m")

def main():
    os.chdir(DIRECTORY)
    
    print("\033[95m")
    print("=" * 50)
    print("   TableMoins Website Server")
    print("   The Almost Perfect Landing Page")
    print("=" * 50)
    print("\033[0m")
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\033[92m✨ Server running at {url}\033[0m")
        print(f"\033[93m📦 Serving directory: {DIRECTORY}\033[0m")
        print(f"\033[96m🌍 Opening browser...\033[0m")
        print("\033[91mPress Ctrl+C to stop the server\033[0m")
        print("-" * 50)
        
        # Try to open browser automatically
        try:
            webbrowser.open(url)
        except:
            print(f"\033[93m⚠️  Could not open browser automatically\033[0m")
            print(f"\033[93m   Please open {url} manually\033[0m")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\033[92m👋 Server stopped. Au revoir!\033[0m")
            return 0

if __name__ == "__main__":
    main()