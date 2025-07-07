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

def _is_template_data(board_data: dict) -> bool:
    """テンプレート由来の動的データかどうかを判定"""
    # デフォルトフィールド名のリスト
    default_fields = {
        'survey_number', 'building_number', 'owner', 'damage_type', 
        'damage_size', 'damage_location', 'photo_number', 'date_taken'
    }
    
    # データのキーをチェック
    data_keys = set(board_data.keys())
    
    # デフォルトフィールド以外のキーがあるか、
    # またはセルID形式(例: "2-1", "A3")のキーがある場合はテンプレートデータ
    has_non_default_keys = not data_keys.issubset(default_fields)
    has_cell_format_keys = any(
        ('-' in key and key.replace('-', '').replace('_', '').isalnum()) or  # "2-1" 形式
        (len(key) >= 2 and key[0].isalpha() and key[1:].isdigit())  # "A3" 形式
        for key in data_keys
    )
    
    return has_non_default_keys or has_cell_format_keys

# Pydanticモデル
class BlackboardDataResponse(BaseModel):
    survey_number: Optional[str]
    building_number: Optional[str]
    owner: Optional[str]
    damage_type: Optional[str]
    damage_size: Optional[str]
    damage_location: Optional[str]
    photo_number: Optional[str]
    date_taken: Optional[str]
    
    class Config:
        from_attributes = True

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
    blackboard_data: Optional[BlackboardDataResponse]

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
    
    # 各写真に対応する黒板データを取得
    photo_responses = []
    for photo in photos:
        blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo.id).first()
        
        # 黒板データをPydanticモデル形式に変換
        blackboard_dict = None
        if blackboard_data:
            blackboard_dict = {
                "survey_number": blackboard_data.survey_number,
                "building_number": blackboard_data.building_number,
                "owner": blackboard_data.owner,
                "damage_type": blackboard_data.damage_type,
                "damage_size": blackboard_data.damage_size,
                "damage_location": blackboard_data.damage_location,
                "photo_number": blackboard_data.photo_number,
                "date_taken": blackboard_data.date_taken,
                "additional_data": blackboard_data.additional_data  # テンプレートデータも含める
            }
        
        photo_dict = {
            "id": photo.id,
            "filename": photo.filename,
            "original_filename": photo.original_filename,
            "file_path": photo.file_path,
            "file_size": photo.file_size,
            "captured_at": photo.captured_at,
            "created_at": photo.created_at,
            "project_id": photo.project_id,
            "subproject_id": photo.subproject_id,
            "blackboard_data": blackboard_dict
        }
        photo_responses.append(photo_dict)
    
    return photo_responses

@router.get("/subproject/{subproject_id}", response_model=List[PhotoResponse])
def get_photos_by_subproject(subproject_id: int, db: Session = Depends(get_db)):
    """特定サブプロジェクトの写真一覧を取得"""
    # サブプロジェクトの存在確認
    subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
    if not subproject:
        raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    photos = db.query(Photo).filter(Photo.subproject_id == subproject_id).all()
    
    # 各写真に対応する黒板データを取得
    photo_responses = []
    for photo in photos:
        blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo.id).first()
        
        # 黒板データをPydanticモデル形式に変換
        blackboard_dict = None
        if blackboard_data:
            blackboard_dict = {
                "survey_number": blackboard_data.survey_number,
                "building_number": blackboard_data.building_number,
                "owner": blackboard_data.owner,
                "damage_type": blackboard_data.damage_type,
                "damage_size": blackboard_data.damage_size,
                "damage_location": blackboard_data.damage_location,
                "photo_number": blackboard_data.photo_number,
                "date_taken": blackboard_data.date_taken,
                "additional_data": blackboard_data.additional_data  # テンプレートデータも含める
            }
        
        photo_dict = {
            "id": photo.id,
            "filename": photo.filename,
            "original_filename": photo.original_filename,
            "file_path": photo.file_path,
            "file_size": photo.file_size,
            "captured_at": photo.captured_at,
            "created_at": photo.created_at,
            "project_id": photo.project_id,
            "subproject_id": photo.subproject_id,
            "blackboard_data": blackboard_dict
        }
        photo_responses.append(photo_dict)
    
    return photo_responses

@router.get("/{photo_id}", response_model=PhotoResponse)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """特定写真の取得"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    
    # 黒板データを取得
    blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo.id).first()
    
    # 黒板データをPydanticモデル形式に変換
    blackboard_dict = None
    if blackboard_data:
        blackboard_dict = {
            "survey_number": blackboard_data.survey_number,
            "building_number": blackboard_data.building_number,
            "owner": blackboard_data.owner,
            "damage_type": blackboard_data.damage_type,
            "damage_size": blackboard_data.damage_size,
            "damage_location": blackboard_data.damage_location,
            "photo_number": blackboard_data.photo_number,
            "date_taken": blackboard_data.date_taken
        }
    
    photo_dict = {
        "id": photo.id,
        "filename": photo.filename,
        "original_filename": photo.original_filename,
        "file_path": photo.file_path,
        "file_size": photo.file_size,
        "captured_at": photo.captured_at,
        "created_at": photo.created_at,
        "project_id": photo.project_id,
        "subproject_id": photo.subproject_id,
        "blackboard_data": blackboard_dict
    }
    
    return photo_dict

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
            
            # テンプレート由来の動的データかデフォルトデータかを判定
            is_template_data = _is_template_data(board_data)
            
            if is_template_data:
                # テンプレートデータの場合: additional_dataに保存
                db_blackboard = BlackboardData(
                    photo_id=db_photo.id,
                    additional_data=board_data  # JSON形式で動的データを保存
                )
            else:
                # デフォルトデータの場合: 既存の固定フィールドに保存
                db_blackboard = BlackboardData(
                    photo_id=db_photo.id,
                    survey_number=board_data.get('survey_number', ''),
                    building_number=board_data.get('building_number', ''),
                    owner=board_data.get('owner', ''),
                    damage_type=board_data.get('damage_type', ''),
                    damage_size=board_data.get('damage_size', ''),
                    damage_location=board_data.get('damage_location', ''),
                    photo_number=board_data.get('photo_number', ''),
                    date_taken=board_data.get('date_taken', '')
                )
            
            db.add(db_blackboard)
            db.commit()
        except json.JSONDecodeError:
            # 黒板データのJSONが無効な場合は無視
            pass
    
    # 黒板データを再取得して適切な形式で返す
    blackboard_data_obj = db.query(BlackboardData).filter(BlackboardData.photo_id == db_photo.id).first()
    
    # 黒板データをPydanticモデル形式に変換
    blackboard_dict = None
    if blackboard_data_obj:
        blackboard_dict = {
            "survey_number": blackboard_data_obj.survey_number,
            "building_number": blackboard_data_obj.building_number,
            "owner": blackboard_data_obj.owner,
            "damage_type": blackboard_data_obj.damage_type,
            "damage_size": blackboard_data_obj.damage_size,
            "damage_location": blackboard_data_obj.damage_location,
            "photo_number": blackboard_data_obj.photo_number,
            "date_taken": blackboard_data_obj.date_taken
        }
    
    return {
        "id": db_photo.id,
        "filename": db_photo.filename,
        "original_filename": db_photo.original_filename,
        "file_path": db_photo.file_path,
        "file_size": db_photo.file_size,
        "captured_at": db_photo.captured_at,
        "created_at": db_photo.created_at,
        "project_id": db_photo.project_id,
        "subproject_id": db_photo.subproject_id,
        "blackboard_data": blackboard_dict
    }

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