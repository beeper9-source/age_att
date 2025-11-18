#!/usr/bin/env python3
"""
간단한 HTTP 서버 실행 스크립트
Python 3가 설치되어 있어야 합니다.
"""
import http.server
import socketserver
import webbrowser
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"서버가 시작되었습니다!")
        print(f"브라우저에서 {url} 을 열어주세요.")
        print(f"종료하려면 Ctrl+C를 누르세요.")
        
        # 자동으로 브라우저 열기
        try:
            webbrowser.open(url)
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")

if __name__ == "__main__":
    main()

