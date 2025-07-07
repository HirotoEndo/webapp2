from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.photo import Photo
from models.project import Project
from models.subproject import SubProject
from models.blackboard_data import BlackboardData
import os
import uuid
import json
from pathlib import Path

router = APIRouter(
    prefix="/api/photos",
    tags=["photos"]
)

# アップロードディレクトリの設定
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Pydanticモデル
class PhotoResponse(BaseModel):
    id: int
    filename: str
    original_filename: Optional[str]
    file_path: str
    file_size: Optional[int]
    captured_at: datetime
    created_at: datetime
    project_id: int
    subproject_id: Optional[int]

    class Config:
        from_attributes = True

@router.get("/project/{project_id}", response_model=List[PhotoResponse])
def get_photos_by_project(project_id: int, db: Session = Depends(get_db)):
    """特定プロジェクトの写真一覧を取得"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    photos = db.query(Photo).filter(Photo.project_id == project_id).all()
    return photos

@router.get("/subproject/{subproject_id}", response_model=List[PhotoResponse])
def get_photos_by_subproject(subproject_id: int, db: Session = Depends(get_db)):
    """特定サブプロジェクトの写真一覧を取得"""
    # サブプロジェクトの存在確認
    subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
    if not subproject:
        raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    photos = db.query(Photo).filter(Photo.subproject_id == subproject_id).all()
    return photos

@router.get("/{photo_id}", response_model=PhotoResponse)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """特定写真の取得"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    return photo

@router.post("/upload", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    subproject_id: Optional[int] = Form(None),
    blackboard_data: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """写真のアップロード"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # サブプロジェクトの存在確認（指定されている場合）
    if subproject_id:
        subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
        if not subproject:
            raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    # ファイル名を生成
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # ファイルを保存
    file_path = UPLOAD_DIR / unique_filename
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # データベースに登録
    db_photo = Photo(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        project_id=project_id,
        subproject_id=subproject_id
    )
    
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    
    # 黒板データがある場合は保存
    if blackboard_data:
        try:
            board_data = json.loads(blackboard_data)
            db_blackboard = BlackboardData(
                photo_id=db_photo.id,
                survey_number=board_data.get('survey_number', ''),
                building_number=board_data.get('building_number', ''),
                owner=board_data.get('owner', ''),
                damage_type=board_data.get('damage_type', ''),
                damage_size=board_data.get('damage_size', ''),
                damage_location=board_data.get('damage_location', ''),
                photo_number=board_data.get('photo_number', '')
            )
            db.add(db_blackboard)
            db.commit()
        except json.JSONDecodeError:
            # 黒板データのJSONが無効な場合は無視
            pass
    
    return db_photo

@router.delete("/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """写真の削除"""
    db_photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    
    # ファイルを削除
    if os.path.exists(db_photo.file_path):
        os.remove(db_photo.file_path)
    
    # データベースから削除
    db.delete(db_photo)
    db.commit()
    
    return {"message": "写真が削除されました"}