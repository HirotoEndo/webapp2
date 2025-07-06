from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables
from routers import projects, photos, templates as template_router, export, subprojects
import logging
import traceback

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時の処理
    logger.info("アプリケーションを開始しています...")
    create_tables()
    logger.info("データベーステーブルを作成しました")
    yield
    # 終了時の処理（必要に応じて）
    logger.info("アプリケーションを終了しています...")

app = FastAPI(
    title="工損調査システム", 
    version="1.0.0", 
    lifespan=lifespan,
    debug=True
)

# CORS設定（開発時のデバッグ用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ルーターを追加
app.include_router(projects.router)
app.include_router(subprojects.router)
app.include_router(photos.router)
app.include_router(template_router.router)
app.include_router(export.router)

# カスタムエラーハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"予期しないエラーが発生しました: {str(exc)}")
    logger.error(f"Request URL: {request.url}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc),
            "traceback": traceback.format_exc() if app.debug else None
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTPException: {exc.status_code} - {exc.detail}")
    logger.warning(f"Request URL: {request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    logger.info("ホームページにアクセスしました")
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/camera", response_class=HTMLResponse)
async def camera_page(request: Request):
    return templates.TemplateResponse("camera.html", {"request": request})

@app.get("/templates", response_class=HTMLResponse)
async def templates_page(request: Request):
    return templates.TemplateResponse("templates.html", {"request": request})

@app.get("/template-editor", response_class=HTMLResponse)
async def template_editor_page(request: Request):
    return templates.TemplateResponse("template_editor.html", {"request": request})

@app.get("/project/{project_id}", response_class=HTMLResponse)
async def project_detail_page(request: Request, project_id: int):
    logger.info(f"プロジェクト詳細ページにアクセス: project_id={project_id}")
    try:
        from database import SessionLocal
        from models.project import Project
        
        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        db.close()
        
        if not project:
            logger.warning(f"プロジェクトが見つかりません: project_id={project_id}")
            raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
        
        logger.info(f"プロジェクト詳細ページを表示: {project.name}")
        return templates.TemplateResponse("project_detail.html", {
            "request": request,
            "project": project
        })
    except Exception as e:
        logger.error(f"プロジェクト詳細ページでエラー: {str(e)}")
        raise

@app.get("/project/{project_id}/subproject/{subproject_id}", response_class=HTMLResponse)
async def subproject_detail_page(request: Request, project_id: int, subproject_id: int):
    logger.info(f"サブプロジェクト詳細ページにアクセス: project_id={project_id}, subproject_id={subproject_id}")
    try:
        from database import SessionLocal
        from models.project import Project
        from models.subproject import SubProject
        
        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        subproject = db.query(SubProject).filter(SubProject.id == subproject_id).first()
        db.close()
        
        if not project:
            logger.warning(f"プロジェクトが見つかりません: project_id={project_id}")
            raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
            
        if not subproject:
            logger.warning(f"サブプロジェクトが見つかりません: subproject_id={subproject_id}")
            raise HTTPException(status_code=404, detail="サブプロジェクト（エリア）が見つかりません")
            
        if subproject.project_id != project_id:
            logger.warning(f"サブプロジェクトが指定されたプロジェクトに属していません")
            raise HTTPException(status_code=404, detail="サブプロジェクトが指定されたプロジェクトに属していません")
        
        logger.info(f"サブプロジェクト詳細ページを表示: {project.name} > {subproject.name}")
        return templates.TemplateResponse("subproject_detail.html", {
            "request": request,
            "project": project,
            "subproject": subproject
        })
    except Exception as e:
        logger.error(f"サブプロジェクト詳細ページでエラー: {str(e)}")
        raise

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    import os
    import socket
    import subprocess
    
    def get_local_ip():
        """ローカルIPアドレスを取得"""
        try:
            # macOSでWi-FiのIPアドレスを取得
            result = subprocess.run(['ifconfig', 'en0'], capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'inet ' in line and '127.0.0.1' not in line:
                    return line.split()[1]
        except:
            pass
        
        # 代替方法
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "IPアドレス取得に失敗"
    
    def print_access_urls(protocol, port, local_ip):
        """アクセスURL一覧を表示"""
        print("\n" + "="*60)
        print("🚀 工損調査システム 起動完了!")
        print("="*60)
        print(f"📱 スマホ・他デバイスからのアクセス:")
        print(f"   {protocol}://{local_ip}:{port}/")
        print(f"   {protocol}://{local_ip}:{port}/camera (撮影画面)")
        print(f"   {protocol}://{local_ip}:{port}/templates (テンプレート管理)")
        print()
        print(f"💻 ローカル（このMac）からのアクセス:")
        print(f"   {protocol}://localhost:{port}/")
        print(f"   {protocol}://127.0.0.1:{port}/")
        print()
        if protocol == "https":
            print("⚠️  HTTPS使用時の注意:")
            print("   - 自己署名証明書のため、ブラウザで「安全でない」警告が表示されます")
            print("   - 「詳細設定」→「安全でないサイトに進む」をクリックしてください")
            print("   - カメラ機能はHTTPS必須です")
        print("="*60)
        print("🛑 停止: Ctrl+C\n")
    
    # ローカルIPアドレスを取得
    local_ip = get_local_ip()
    
    # SSL証明書のパスを確認
    cert_file = "certs/cert.pem"
    key_file = "certs/key.pem"
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        # HTTPS対応で起動
        port = 8443
        protocol = "https"
        print_access_urls(protocol, port, local_ip)
        
        uvicorn.run(
            "app:app", 
            host="0.0.0.0", 
            port=port,
            reload=True,
            ssl_keyfile=key_file,
            ssl_certfile=cert_file
        )
    else:
        # HTTP起動（証明書がない場合）
        port = 8000
        protocol = "http"
        print("⚠️  SSL証明書が見つかりません。HTTP mode で起動します。")
        print("📱 カメラ機能を使用するにはHTTPS環境が必要です。")
        print_access_urls(protocol, port, local_ip)
        
        uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)