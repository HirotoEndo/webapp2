from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models.project import Project
from models.subproject import SubProject
from models.photo import Photo
from models.blackboard_data import BlackboardData
import os
import tempfile
from pathlib import Path

router = APIRouter(
    prefix="/api/export",
    tags=["export"]
)

# Pydanticモデル
class ExportRequest(BaseModel):
    project_id: int
    subproject_id: Optional[int] = None
    include_photos: bool = True
    format: str = "excel"  # "excel", "pdf"

@router.post("/project/{project_id}")
def export_project(
    project_id: int,
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    """プロジェクトデータのエクスポート"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # サブプロジェクトの存在確認（指定されている場合）
    subproject = None
    if export_request.subproject_id:
        subproject = db.query(SubProject).filter(SubProject.id == export_request.subproject_id).first()
        if not subproject:
            raise HTTPException(status_code=404, detail="サブプロジェクトが見つかりません")
    
    # 写真データの取得
    photos_query = db.query(Photo).filter(Photo.project_id == project_id)
    if export_request.subproject_id:
        photos_query = photos_query.filter(Photo.subproject_id == export_request.subproject_id)
    
    photos = photos_query.all()
    
    # 写真台帳の生成
    if export_request.format == "excel":
        return export_to_excel(project, subproject, photos, db)
    else:
        raise HTTPException(status_code=400, detail="サポートされていないエクスポート形式です")

def export_to_excel(project: Project, subproject: Optional[SubProject], photos: List[Photo], db: Session):
    """Excel形式での写真台帳出力"""
    try:
        # TODO: openpyxlを使用してExcelファイルを生成
        # 現在は仮の実装
        
        # 一時ファイルを作成
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        temp_file.close()
        
        # 実際のExcel生成処理をここに実装
        # - プロジェクト情報の埋め込み
        # - 写真の埋め込み
        # - 黒板データの埋め込み
        
        # 仮のファイル名を設定
        if subproject:
            filename = f"{project.name}_{subproject.name}_写真台帳.xlsx"
        else:
            filename = f"{project.name}_写真台帳.xlsx"
        
        return FileResponse(
            path=temp_file.name,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"エクスポート処理中にエラーが発生しました: {str(e)}")

@router.get("/project/{project_id}/preview")
def preview_export(project_id: int, subproject_id: Optional[int] = None, db: Session = Depends(get_db)):
    """エクスポートプレビュー"""
    # プロジェクトの存在確認
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
    
    # 写真データの取得
    photos_query = db.query(Photo).filter(Photo.project_id == project_id)
    if subproject_id:
        photos_query = photos_query.filter(Photo.subproject_id == subproject_id)
    
    photos = photos_query.all()
    
    # プレビュー情報を返す
    return {
        "project_name": project.name,
        "photo_count": len(photos),
        "photos": [
            {
                "id": photo.id,
                "filename": photo.filename,
                "captured_at": photo.captured_at
            }
            for photo in photos
        ]
    }