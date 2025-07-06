from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Layout(Base):
    __tablename__ = "layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)  # テンプレート名
    description = Column(Text)
    
    # Excelテンプレートの情報
    excel_filename = Column(String(255))     # 元のExcelファイル名
    excel_file_path = Column(String(500))    # Excelファイルのパス
    
    # セル結合情報とレイアウト情報（JSON形式）
    cell_data = Column(JSON)                 # セルの値データ
    merged_cells = Column(JSON)              # セル結合情報
    cell_styles = Column(JSON)               # セルスタイル情報
    layout_config = Column(JSON)             # レイアウト設定
    
    # 黒板のデフォルト設定
    default_width = Column(Integer, default=400)
    default_height = Column(Integer, default=300)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # リレーションシップ
    blackboard_data = relationship("BlackboardData", back_populates="layout")