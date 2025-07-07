from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.project import Project
from models.subproject import SubProject
from models.photo import Photo
from models.blackboard_data import BlackboardData
import os
from pathlib import Path

router = APIRouter(
    prefix="/api/projects",
    tags=["projects"]
)

# Pydanticモデル
class ProjectCreate(BaseModel):
    name: str
    location: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ProjectResponse])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """全プロジェクトの取得"""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """特定プロジェクトの取得"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    return project

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """新規プロジェクトの作成"""
    db_project = Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project: ProjectCreate, db: Session = Depends(get_db)):
    """プロジェクトの更新"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    for key, value in project.dict().items():
        setattr(db_project, key, value)
    
    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """プロジェクトの完全削除（関連データとファイルも含む）"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    try:
        # 1. プロジェクトに関連する写真ファイルを削除
        photos = db.query(Photo).filter(Photo.project_id == project_id).all()
        deleted_files = []
        for photo in photos:
            if os.path.exists(photo.file_path):
                os.remove(photo.file_path)
                deleted_files.append(photo.file_path)
            
            # 黒板データを削除
            blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo.id).all()
            for bd in blackboard_data:
                db.delete(bd)
        
        # 2. 写真レコードを削除
        for photo in photos:
            db.delete(photo)
        
        # 3. サブプロジェクトを削除
        subprojects = db.query(SubProject).filter(SubProject.project_id == project_id).all()
        for subproject in subprojects:
            db.delete(subproject)
        
        # 4. プロジェクト本体を削除
        db.delete(db_project)
        
        db.commit()
        
        return {
            "message": "プロジェクトが完全に削除されました",
            "deleted_photos": len(photos),
            "deleted_subprojects": len(subprojects),
            "deleted_files": deleted_files
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"削除処理中にエラーが発生しました: {str(e)}")