from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLiteデータベースファイルのパス
SQLALCHEMY_DATABASE_URL = "sqlite:///./damage_inspection.db"

# SQLAlchemyエンジンの作成
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite用の設定
)

# セッションファクトリの作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースクラスの作成
Base = declarative_base()

def get_db():
    """データベースセッションの取得"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """データベーステーブルの作成"""
    # モデルをインポート
    from models import project, subproject, photo, blackboard_data, layout
    
    # テーブルを作成
    Base.metadata.create_all(bind=engine)