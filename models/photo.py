from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    captured_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 外部キー
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    subproject_id = Column(Integer, ForeignKey("subprojects.id"), nullable=True)
    
    # リレーションシップ
    project = relationship("Project", back_populates="photos")
    subproject = relationship("SubProject", back_populates="photos")
    blackboard_data = relationship("BlackboardData", back_populates="photo", cascade="all, delete-orphan")