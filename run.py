"""CloudSync Sunucu Başlatıcı"""
import sys
import os
import argparse

# Proje kökünü Python path'e ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server.main import app

if __name__ == "__main__":
    import uvicorn
    
    parser = argparse.ArgumentParser(description="CloudSync Web Server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8765)), help="Sunucu portu")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Sunucu hostu")
    args = parser.parse_args()
    
    print("=" * 55)
    print("  CloudSync Sunucusu Baslatiliyor...")
    print(f"  Web Arayuzu: http://localhost:{args.port}")
    print("  Varsayilan Giris: admin / admin123")
    print("=" * 55)
    
    uvicorn.run(app, host=args.host, port=args.port)
