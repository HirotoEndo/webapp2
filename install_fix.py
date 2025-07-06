#!/usr/bin/env python3
"""
依存関係インストール修正スクリプト
Python 3.13環境での互換性問題を解決
"""

import subprocess
import sys

def install_packages():
    """個別に依存関係をインストール"""
    packages = [
        "fastapi>=0.104.1",
        "uvicorn[standard]>=0.24.0", 
        "sqlalchemy>=2.0.23",
        "pydantic>=2.5.0",
        "python-multipart>=0.0.6",
        "jinja2>=3.1.2",
        "aiofiles>=23.2.1",
        "openpyxl>=3.1.2",
        "python-jose[cryptography]>=3.3.0",
        "python-dateutil>=2.8.2",
        "requests>=2.31.0"
    ]
    
    print("📦 基本パッケージをインストール中...")
    for package in packages:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            print(f"✅ {package} インストール完了")
        except subprocess.CalledProcessError as e:
            print(f"❌ {package} インストール失敗: {e}")
    
    # Pillowを最後に別途インストール
    print("🖼️ Pillowをインストール中...")
    try:
        # 最新版を試す
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pillow"])
        print("✅ Pillow インストール完了")
    except subprocess.CalledProcessError:
        print("⚠️ Pillowのインストールに失敗しました")
        print("画像処理機能は一時的に無効になります")

if __name__ == "__main__":
    install_packages()
    print("\n✅ 依存関係のインストールが完了しました")
    print("python run.py でアプリケーションを起動してください")