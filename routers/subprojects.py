from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.subproject import SubProject
from models.project import Project

router = APIRouter(
    prefix="/api/subprojects",
    tags=["subprojects"]
)

# Pydanticモデル
class SubProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: int

class SubProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/project/{project_id}", response_model=List[SubProjectResponse])
def get_subprojects_by_project(project_id: int, db: Session = Depends(get_db)):
    """特定プロジェクトのサブプロジェクト一覧を取得"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    subprojects = db.query(SubProject).filter(SubProject.project_id == project_id).all()
    return subprojects

@router.get("/{subproject_id}", response_model=SubProjectResponse)
def get_subproject(subproject_id: int, db: Session = Depends(get_db)):
    """特定サブプロジェクトの取得"""
    subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
    if not subproject:
        raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    return subproject

@router.post("/", response_model=SubProjectResponse)
def create_subproject(subproject: SubProjectCreate, db: Session = Depends(get_db)):
    """新規サブプロジェクトの作成"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == subproject.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    db_subproject = SubProject(**subproject.dict())
    db.add(db_subproject)
    db.commit()
    db.refresh(db_subproject)
    return db_subproject

@router.put("/{subproject_id}", response_model=SubProjectResponse)
def update_subproject(subproject_id: int, subproject: SubProjectCreate, db: Session = Depends(get_db)):
    """サブプロジェクトの更新"""
    db_subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
    if not db_subproject:
        raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    for key, value in subproject.dict().items():
        setattr(db_subproject, key, value)
    
    db_subproject.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_subproject)
    return db_subproject

@router.delete("/{subproject_id}")
def delete_subproject(subproject_id: int, db: Session = Depends(get_db)):
    """サブプロジェクトの削除"""
    db_subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
    if not db_subproject:
        raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    db.delete(db_subproject)
    db.commit()
    return {"message": "サブプロジェクトが削除されました"}