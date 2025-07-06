#!/usr/bin/env python3
"""
工損調査システム 起動スクリプト
"""

import os
import sys
import subprocess
import socket
from pathlib import Path

def check_python_version():
    """Python バージョンチェック"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8以上が必要です")
        print(f"現在のバージョン: {sys.version}")
        sys.exit(1)
    print(f"✅ Python {sys.version.split()[0]} 検出")

def install_requirements():
    """依存関係のインストール"""
    print("📦 依存関係をインストール中...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ 依存関係のインストール完了")
    except subprocess.CalledProcessError:
        print("❌ 依存関係のインストールに失敗しました")
        sys.exit(1)

def create_directories():
    """必要なディレクトリを作成"""
    directories = [
        "uploads",
        "templates_excel",
        "exports",
        "logs",
        "certs"
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    
    print("✅ ディレクトリ作成完了")

def get_local_ip():
    """ローカルIPアドレスを取得"""
    try:
        # macOSでWi-FiのIPアドレスを取得
        result = subprocess.run(['ifconfig', 'en0'], capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if 'inet ' in line and '127.0.0.1' not in line:
                return line.split()[1]
    except:
        pass
    
    # 代替方法
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

def create_ssl_certificates():
    """自己署名SSL証明書の作成"""
    cert_dir = Path("certs")
    cert_file = cert_dir / "cert.pem"
    key_file = cert_dir / "key.pem"
    
    if cert_file.exists() and key_file.exists():
        print("✅ SSL証明書が存在します")
        return True
    
    print("🔐 SSL証明書を作成中...")
    try:
        subprocess.check_call([
            "openssl", "req", "-x509", "-newkey", "rsa:4096", 
            "-keyout", str(key_file), 
            "-out", str(cert_file), 
            "-days", "365", "-nodes",
            "-subj", "/C=JP/ST=Tokyo/L=Tokyo/O=DamageInspection/CN=localhost"
        ])
        print("✅ SSL証明書作成完了")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  SSL証明書の作成に失敗しました（HTTP mode で起動します）")
        return False

def print_startup_info(local_ip, has_ssl):
    """起動情報を表示"""
    protocol = "https" if has_ssl else "http"
    port = 8443 if has_ssl else 8000
    
    print("\n" + "="*60)
    print("🚀 工損調査システム 起動完了!")
    print("="*60)
    print(f"📱 スマホ・他デバイスからのアクセス:")
    print(f"   {protocol}://{local_ip}:{port}/")
    print(f"   {protocol}://{local_ip}:{port}/camera (撮影画面)")
    print(f"   {protocol}://{local_ip}:{port}/templates (テンプレート管理)")
    print()
    print(f"💻 ローカル（このMac）からのアクセス:")
    print(f"   {protocol}://localhost:{port}/")
    print(f"   {protocol}://127.0.0.1:{port}/")
    print()
    
    if has_ssl:
        print("⚠️  HTTPS使用時の注意:")
        print("   - 自己署名証明書のため、ブラウザで「安全でない」警告が表示されます")
        print("   - 「詳細設定」→「安全でないサイトに進む」をクリックしてください")
        print("   - カメラ機能はHTTPS必須です")
    else:
        print("⚠️  HTTP mode で起動中:")
        print("   - カメラ機能を使用するにはHTTPS環境が必要です")
        print("   - SSL証明書を作成して再起動してください")
    
    print("="*60)
    print("🛑 停止: Ctrl+C\n")

def main():
    """メイン関数"""
    print("🔧 工損調査システム セットアップ開始")
    
    # Python バージョンチェック
    check_python_version()
    
    # 依存関係インストール
    install_requirements()
    
    # ディレクトリ作成
    create_directories()
    
    # SSL証明書作成
    has_ssl = create_ssl_certificates()
    
    # ローカルIP取得
    local_ip = get_local_ip()
    
    # 起動情報表示
    print_startup_info(local_ip, has_ssl)
    
    # アプリケーション起動
    try:
        import uvicorn
        
        if has_ssl:
            uvicorn.run(
                "app:app",
                host="0.0.0.0",
                port=8443,
                reload=True,
                ssl_keyfile="certs/key.pem",
                ssl_certfile="certs/cert.pem"
            )
        else:
            uvicorn.run(
                "app:app",
                host="0.0.0.0",
                port=8000,
                reload=True
            )
    except ImportError:
        print("❌ uvicorn がインストールされていません")
        print("pip install uvicorn でインストールしてください")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 システムを停止しました")
    except Exception as e:
        print(f"❌ 起動エラー: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()