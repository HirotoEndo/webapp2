from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class SubProject(Base):
    __tablename__ = "subprojects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)  # 例: "外構", "内部", "車庫"
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 外部キー
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # リレーションシップ
    project = relationship("Project", back_populates="subprojects")
    photos = relationship("Photo", back_populates="subproject", cascade="all, delete-orphan")