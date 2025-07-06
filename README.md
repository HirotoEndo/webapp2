# 工損調査用Webアプリケーション

現場で撮影した写真に黒板情報を合成し、Excel形式の写真台帳を出力する工損調査専用システムです。

## 🚀 主な機能

### ✨ 基本機能
- **プロジェクト管理**: 階層構造による案件・エリア分類
- **写真撮影**: Webカメラを使用したリアルタイム撮影
- **電子黒板**: 撮影映像上にオーバーレイ表示
- **テンプレート管理**: Excelファイルベースの黒板レイアウト
- **写真台帳出力**: Excel形式での台帳生成・印刷

### 📱 iPad対応
- **タッチ操作**: iPad等タブレット端末での操作に最適化
- **レスポンシブUI**: デバイスサイズに応じた画面表示
- **ドラッグ＆ドロップ**: 黒板位置の調整可能

### 🏗️ システム構成
- **バックエンド**: FastAPI (Python)
- **フロントエンド**: HTML/CSS/JavaScript + Bootstrap
- **データベース**: SQLite
- **画像処理**: Pillow
- **Excel処理**: openpyxl

## 📋 必要な環境

- **Python**: 3.8 以上
- **OS**: macOS, Windows, Linux
- **ブラウザ**: Chrome, Safari, Firefox (カメラ機能にはHTTPS必須)

## 🛠️ セットアップ

### 1. プロジェクトのダウンロード
```bash
git clone <repository-url>
cd webapp2
```

### 2. 自動セットアップ（推奨）
```bash
python run.py
```

自動セットアップでは以下が実行されます：
- Python依存関係のインストール
- 必要ディレクトリの作成
- SSL証明書の生成
- アプリケーションの起動

### 3. 手動セットアップ
```bash
# 依存関係のインストール
pip install -r requirements.txt

# 必要ディレクトリの作成
mkdir uploads templates_excel exports logs certs

# SSL証明書の作成（HTTPS用）
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

# アプリケーションの起動
python app.py
```

## 🌐 アクセス方法

### HTTPS対応（推奨）
- **ローカル**: https://localhost:8443/
- **他デバイス**: https://[IPアドレス]:8443/

### HTTP（証明書がない場合）
- **ローカル**: http://localhost:8000/
- **他デバイス**: http://[IPアドレス]:8000/

⚠️ **注意**: カメラ機能を使用するにはHTTPS環境が必要です

## 📖 使用方法

### 1. プロジェクト作成
1. ホーム画面の「新規プロジェクト作成」をクリック
2. プロジェクト名、場所、説明を入力
3. 「作成」ボタンで保存

### 2. エリア（サブプロジェクト）作成
1. プロジェクト詳細画面の「新規エリア」をクリック
2. エリア名（例：外構、内部、車庫）を入力
3. 「作成」ボタンで保存

### 3. 撮影
1. 撮影画面にアクセス
2. 設定パネルでプロジェクト・エリアを選択
3. 黒板内容を編集
4. 「黒板」ボタンで黒板を表示
5. 「撮影」ボタンで写真を撮影
6. 「保存」ボタンで保存

### 4. テンプレート管理
1. テンプレート管理画面にアクセス
2. 「Excelテンプレートをアップロード」をクリック
3. Excelファイルを選択してアップロード

### 5. 写真台帳出力
1. プロジェクト詳細画面の「エクスポート」をクリック
2. Excel形式の写真台帳がダウンロード

## 📁 プロジェクト構造

```
webapp2/
├── app.py                  # メインアプリケーション
├── database.py             # データベース設定
├── requirements.txt        # Python依存関係
├── run.py                 # 起動スクリプト
├── models/                # データベースモデル
│   ├── project.py
│   ├── subproject.py
│   ├── photo.py
│   ├── blackboard_data.py
│   └── layout.py
├── routers/               # APIルーター
│   ├── projects.py
│   ├── subprojects.py
│   ├── photos.py
│   ├── templates.py
│   └── export.py
├── templates/             # HTMLテンプレート
│   ├── base.html
│   ├── index.html
│   ├── camera.html
│   ├── templates.html
│   ├── project_detail.html
│   └── subproject_detail.html
├── static/                # 静的ファイル
│   ├── css/
│   ├── js/
│   └── img/
├── uploads/               # アップロード画像
├── templates_excel/       # Excelテンプレート
├── exports/              # エクスポートファイル
├── logs/                 # ログファイル
└── certs/                # SSL証明書
```

## 🔧 API仕様

### プロジェクト管理
- `GET /api/projects/` - プロジェクト一覧取得
- `POST /api/projects/` - プロジェクト作成
- `GET /api/projects/{id}` - プロジェクト詳細取得
- `PUT /api/projects/{id}` - プロジェクト更新
- `DELETE /api/projects/{id}` - プロジェクト削除

### サブプロジェクト管理
- `GET /api/subprojects/project/{project_id}` - サブプロジェクト一覧取得
- `POST /api/subprojects/` - サブプロジェクト作成
- `GET /api/subprojects/{id}` - サブプロジェクト詳細取得
- `PUT /api/subprojects/{id}` - サブプロジェクト更新
- `DELETE /api/subprojects/{id}` - サブプロジェクト削除

### 写真管理
- `GET /api/photos/project/{project_id}` - プロジェクト写真一覧取得
- `GET /api/photos/subproject/{subproject_id}` - サブプロジェクト写真一覧取得
- `POST /api/photos/upload` - 写真アップロード
- `GET /api/photos/{id}` - 写真詳細取得
- `DELETE /api/photos/{id}` - 写真削除

### テンプレート管理
- `GET /api/templates/` - テンプレート一覧取得
- `POST /api/templates/upload` - Excelテンプレートアップロード
- `GET /api/templates/{id}` - テンプレート詳細取得
- `DELETE /api/templates/{id}` - テンプレート削除

### エクスポート
- `POST /api/export/project/{project_id}` - 写真台帳エクスポート
- `GET /api/export/project/{project_id}/preview` - エクスポートプレビュー

## 🐛 トラブルシューティング

### カメラが起動しない
- ブラウザのカメラ権限を確認
- HTTPS環境で動作していることを確認
- 他のアプリでカメラが使用されていないか確認

### SSL証明書エラー
- ブラウザで「詳細設定」→「安全でないサイトに進む」を選択
- 証明書を再作成: `openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes`

### 依存関係エラー
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### データベースエラー
```bash
# データベースファイルを削除して再作成
rm damage_inspection.db
python app.py
```

## 🔮 今後の機能拡張

- [ ] Excel テンプレートの詳細解析（SheetJS実装）
- [ ] 黒板レイアウトの高度な編集機能
- [ ] 画像と黒板の自動合成（Pillow実装）
- [ ] PDF形式での台帳出力
- [ ] クラウドストレージ連携
- [ ] ユーザー認証機能
- [ ] バックアップ・復元機能

## 📄 ライセンス

このプロジェクトは工損調査業務専用に開発されています。

## 🤝 サポート

技術的な問題や機能要望については、開発チームまでお問い合わせください。