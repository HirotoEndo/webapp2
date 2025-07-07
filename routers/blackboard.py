from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.blackboard_data import BlackboardData
from models.photo import Photo

router = APIRouter(
    prefix="/api/blackboard",
    tags=["blackboard"]
)

# Pydanticモデル
class BlackboardDataCreate(BaseModel):
    photo_id: int
    survey_number: Optional[str] = None
    building_number: Optional[str] = None
    owner: Optional[str] = None
    damage_type: Optional[str] = None
    damage_size: Optional[str] = None
    damage_location: Optional[str] = None
    photo_number: Optional[str] = None
    date_taken: Optional[str] = None

class BlackboardDataUpdate(BaseModel):
    survey_number: Optional[str] = None
    building_number: Optional[str] = None
    owner: Optional[str] = None
    damage_type: Optional[str] = None
    damage_size: Optional[str] = None
    damage_location: Optional[str] = None
    photo_number: Optional[str] = None
    date_taken: Optional[str] = None

class BlackboardDataResponse(BaseModel):
    id: int
    photo_id: int
    survey_number: Optional[str]
    building_number: Optional[str]
    owner: Optional[str]
    damage_type: Optional[str]
    damage_size: Optional[str]
    damage_location: Optional[str]
    photo_number: Optional[str]
    date_taken: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/photo/{photo_id}", response_model=BlackboardDataResponse)
def get_blackboard_by_photo(photo_id: int, db: Session = Depends(get_db)):
    """特定写真の黒板データを取得"""
    # 写真の存在確認
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    
    blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo_id).first()
    if not blackboard_data:
        raise HTTPException(status_code=404, detail="黒板データが見つかりません")
    
    return blackboard_data

@router.post("/", response_model=BlackboardDataResponse)
def create_blackboard_data(blackboard: BlackboardDataCreate, db: Session = Depends(get_db)):
    """新規黒板データの作成"""
    # 写真の存在確認
    photo = db.query(Photo).filter(Photo.id == blackboard.photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    
    # 既存の黒板データがある場合はエラー
    existing = db.query(BlackboardData).filter(BlackboardData.photo_id == blackboard.photo_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="この写真には既に黒板データが存在します")
    
    db_blackboard = BlackboardData(**blackboard.dict())
    db.add(db_blackboard)
    db.commit()
    db.refresh(db_blackboard)
    return db_blackboard

@router.put("/photo/{photo_id}", response_model=BlackboardDataResponse)
def update_blackboard_data(photo_id: int, blackboard: BlackboardDataUpdate, db: Session = Depends(get_db)):
    """写真の黒板データを更新（なければ作成）"""
    # 写真の存在確認
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="写真が見つかりません")
    
    # 既存の黒板データを取得
    db_blackboard = db.query(BlackboardData).filter(BlackboardData.photo_id == photo_id).first()
    
    if db_blackboard:
        # 既存データを更新
        for key, value in blackboard.dict(exclude_unset=True).items():
            setattr(db_blackboard, key, value)
        db_blackboard.updated_at = datetime.utcnow()
    else:
        # 新規作成
        blackboard_dict = blackboard.dict(exclude_unset=True)
        blackboard_dict['photo_id'] = photo_id
        db_blackboard = BlackboardData(**blackboard_dict)
        db.add(db_blackboard)
    
    db.commit()
    db.refresh(db_blackboard)
    return db_blackboard

@router.delete("/photo/{photo_id}")
def delete_blackboard_data(photo_id: int, db: Session = Depends(get_db)):
    """写真の黒板データを削除"""
    blackboard_data = db.query(BlackboardData).filter(BlackboardData.photo_id == photo_id).first()
    if not blackboard_data:
        raise HTTPException(status_code=404, detail="黒板データが見つかりません")
    
    db.delete(blackboard_data)
    db.commit()
    return {"message": "黒板データが削除されました"}