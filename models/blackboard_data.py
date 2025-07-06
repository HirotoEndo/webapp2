from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class BlackboardData(Base):
    __tablename__ = "blackboard_data"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 黒板の基本情報
    survey_number = Column(String(50))       # 調査番号
    building_number = Column(String(50))     # 建物番号
    owner = Column(String(100))              # 所有者
    damage_type = Column(String(100))        # 傷の種類
    damage_size = Column(String(100))        # 寸法
    damage_location = Column(String(200))    # 損傷箇所
    photo_number = Column(String(50))        # 写真番号
    date_taken = Column(String(50))          # 撮影日
    
    # 追加フィールド（JSON形式で自由度を持たせる）
    additional_data = Column(JSON)
    
    # レイアウト情報
    position_x = Column(Integer, default=0)  # 黒板の表示位置X
    position_y = Column(Integer, default=0)  # 黒板の表示位置Y
    width = Column(Integer, default=400)     # 黒板の幅
    height = Column(Integer, default=300)    # 黒板の高さ
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 外部キー
    photo_id = Column(Integer, ForeignKey("photos.id"), nullable=False)
    layout_id = Column(Integer, ForeignKey("layouts.id"), nullable=True)
    
    # リレーションシップ
    photo = relationship("Photo", back_populates="blackboard_data")
    layout = relationship("Layout", back_populates="blackboard_data")