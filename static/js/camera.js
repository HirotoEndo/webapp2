// カメラ画面のJavaScript機能
let currentStream = null;
let currentCamera = 'user';
let blackboardVisible = false;
let capturedImageData = null;
let gridVisible = false;
let timerActive = false;
let currentResolution = { width: 1920, height: 1080 };

// Promise rejection の詳細デバッグ
window.addEventListener('unhandledrejection', function(event) {
    console.error('DEBUG: UNHANDLED PROMISE REJECTION DETECTED!');
    console.error('DEBUG: Promise:', event.promise);
    console.error('DEBUG: Reason:', event.reason);
    console.error('DEBUG: Stack trace:', event.reason ? event.reason.stack : 'No stack trace');
    console.error('DEBUG: Event object:', event);
});

// Error イベントもキャッチ
window.addEventListener('error', function(event) {
    console.error('DEBUG: GLOBAL ERROR DETECTED!');
    console.error('DEBUG: Message:', event.message);
    console.error('DEBUG: Filename:', event.filename);
    console.error('DEBUG: Line:', event.lineno);
    console.error('DEBUG: Column:', event.colno);
    console.error('DEBUG: Error object:', event.error);
});

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DEBUG: DOMContentLoaded - Camera page initialization started');
    
    // ナビゲーションを隠す
    const navbar = document.querySelector('.navbar');
    const main = document.querySelector('main');
    
    if (navbar) {
        navbar.classList.add('hide-nav');
        console.log('DEBUG: Navbar hidden');
    } else {
        console.log('DEBUG: Navbar not found');
    }
    
    if (main) {
        main.style.margin = '0';
        main.style.padding = '0';
        console.log('DEBUG: Main element styles updated');
    } else {
        console.log('DEBUG: Main element not found');
    }
    
    // カメラの初期化
    console.log('DEBUG: Starting camera initialization');
    initCamera().catch(error => {
        console.error('DEBUG: Camera initialization failed in DOMContentLoaded:', error);
    });
    
    // データの読み込み
    loadProjects().catch(error => {
        console.error('DEBUG: loadProjects failed:', error);
    });
    loadTemplates().then(() => {
        console.log('DEBUG: loadTemplates completed successfully');
        // URLパラメータからテンプレートIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const templateId = urlParams.get('template');
        const projectId = urlParams.get('project');
        const subprojectId = urlParams.get('subproject');
        
        // テンプレートIDがある場合は自動適用
        if (templateId) {
            document.getElementById('templateSelect').value = templateId;
            applyTemplate().catch(error => {
                console.error('DEBUG: applyTemplate failed:', error);
            });
        }
        
        // プロジェクトIDがある場合は自動選択
        if (projectId) {
            document.getElementById('projectSelect').value = projectId;
            loadSubprojects().then(() => {
                if (subprojectId) {
                    document.getElementById('subprojectSelect').value = subprojectId;
                }
                // プロジェクト選択後に写真番号を更新
                generatePhotoNumber();
            }).catch(error => {
                console.error('DEBUG: loadSubprojects failed:', error);
            });
        }
    }).catch(error => {
        console.error('DEBUG: loadTemplates failed:', error);
    });
    
    // 黒板のドラッグ機能の設定
    setupBlackboardDrag();
    
    // iPad対応の追加設定
    setupIPadTouchPrevention();
    
    // ストリーム監視を開始
    startStreamMonitoring();
    
    // 撮影日を設定
    document.getElementById('dateTaken').textContent = new Date().toLocaleDateString('ja-JP');
    
    // 写真番号の自動採番
    generatePhotoNumber();
    
    // 終了ボタンのイベントリスナーを追加
    const exitButton = document.getElementById('exitButton');
    if (exitButton) {
        console.log('DEBUG: Adding event listener to exit button');
        exitButton.addEventListener('click', function(event) {
            console.log('DEBUG: Exit button clicked via addEventListener');
            event.preventDefault();
            event.stopPropagation();
            exitFullscreen();
        });
    } else {
        console.log('DEBUG: Exit button not found');
    }
});

// カメラの初期化
async function initCamera() {
    console.log('DEBUG: initCamera() called');
    
    try {
        // 既存のストリームが有効で同じ設定なら再利用
        if (currentStream && checkCameraStreamStatus()) {
            console.log('DEBUG: Reusing existing camera stream');
            return;
        }
        
        const constraints = {
            video: {
                facingMode: currentCamera,
                width: { ideal: currentResolution.width },
                height: { ideal: currentResolution.height }
            }
        };
        
        console.log('DEBUG: Camera constraints:', constraints);
        
        // 既存ストリームを停止
        if (currentStream) {
            console.log('DEBUG: Stopping existing stream');
            currentStream.getTracks().forEach(track => {
                console.log('DEBUG: Stopping existing track:', track.kind, track.readyState);
                track.stop();
            });
        }
        
        console.log('DEBUG: Requesting new media stream');
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('DEBUG: Media stream obtained, tracks:', currentStream.getTracks().length);
        currentStream.getTracks().forEach((track, index) => {
            console.log(`DEBUG: New track ${index}: kind=${track.kind}, readyState=${track.readyState}, enabled=${track.enabled}`);
        });
        
        const video = document.getElementById('cameraVideo');
        console.log('DEBUG: Setting video srcObject');
        video.srcObject = currentStream;
        
        // ビデオイベントリスナーは重複を避けるため一度だけ設定
        if (!video.hasAttribute('data-listeners-added')) {
            video.addEventListener('loadedmetadata', () => {
                console.log('DEBUG: Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            });
            
            video.addEventListener('playing', () => {
                console.log('DEBUG: Video playing started');
            });
            
            video.addEventListener('error', (e) => {
                console.error('DEBUG: Video element error:', e);
            });
            
            video.setAttribute('data-listeners-added', 'true');
        }
        
        // 画質設定を適用
        applyImageFilters();
        
        console.log('DEBUG: Camera initialization completed');
        
    } catch (error) {
        console.error('DEBUG: カメラの初期化に失敗しました:', error);
        
        // より詳細なエラーメッセージ
        if (error.name === 'NotAllowedError') {
            alert('カメラのアクセス許可が拒否されました。ブラウザの設定でカメラの使用を許可してください。');
        } else if (error.name === 'NotFoundError') {
            alert('カメラが見つかりません。カメラが接続されているか確認してください。');
        } else if (error.name === 'NotReadableError') {
            alert('カメラが他のアプリケーションで使用中です。');
        } else {
            alert('カメラの初期化に失敗しました。ページを更新してお試しください。');
        }
    }
}

// カメラの切り替え
async function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    await initCamera();
}

// 解像度の変更
async function changeResolution() {
    const resolutionSelect = document.getElementById('resolutionSelect');
    const resolution = resolutionSelect.value;
    
    if (resolution === 'auto') {
        currentResolution = { width: 1920, height: 1080 };
    } else {
        const [width, height] = resolution.split('x').map(Number);
        currentResolution = { width, height };
    }
    
    await initCamera();
}

// 画質調整の適用
function adjustImageSettings() {
    const brightness = document.getElementById('brightnessSlider').value;
    const contrast = document.getElementById('contrastSlider').value;
    const saturation = document.getElementById('saturationSlider').value;
    
    document.getElementById('brightnessValue').textContent = brightness + '%';
    document.getElementById('contrastValue').textContent = contrast + '%';
    document.getElementById('saturationValue').textContent = saturation + '%';
    
    applyImageFilters();
}

// フィルターの適用
function applyImageFilters() {
    const video = document.getElementById('cameraVideo');
    const brightness = document.getElementById('brightnessSlider').value;
    const contrast = document.getElementById('contrastSlider').value;
    const saturation = document.getElementById('saturationSlider').value;
    
    video.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
}

// 画質設定のリセット
function resetImageSettings() {
    document.getElementById('brightnessSlider').value = 100;
    document.getElementById('contrastSlider').value = 100;
    document.getElementById('saturationSlider').value = 100;
    
    adjustImageSettings();
}

// フラッシュの切り替え
function toggleFlash() {
    const flashSelect = document.getElementById('flashSelect');
    const flashMode = flashSelect.value;
    
    if (currentStream) {
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        
        if (capabilities.torch) {
            track.applyConstraints({
                advanced: [{ torch: flashMode === 'on' }]
            }).catch(error => {
                console.log('フラッシュ制御に対応していません:', error);
            });
        }
    }
}

// 終了処理
function exitFullscreen() {
    console.log('DEBUG: ========== exitFullscreen() START ==========');
    
    try {
        // 最もシンプルなアプローチ：即座にナビゲーション
        console.log('DEBUG: Simple navigation approach');
        
        // クリーンアップは最小限に
        if (currentStream) {
            console.log('DEBUG: Quick stream cleanup');
            try {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
                console.log('DEBUG: Stream cleanup completed');
            } catch (e) {
                console.log('DEBUG: Stream cleanup error (ignored):', e);
            }
        }
        
        // UI復元も最小限に
        try {
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.classList.remove('hide-nav');
                console.log('DEBUG: Navbar restored');
            }
            
            const main = document.querySelector('main');
            if (main) {
                main.style.margin = '';
                main.style.padding = '';
                console.log('DEBUG: Main styles restored');
            }
        } catch (e) {
            console.log('DEBUG: UI cleanup error (ignored):', e);
        }
        
        // 即座にナビゲーション（エラーを無視）
        console.log('DEBUG: Starting navigation');
        
        if (window.history.length > 1) {
            console.log('DEBUG: Using history.back()');
            window.history.back();
        } else {
            console.log('DEBUG: Using location.href');
            window.location.href = '/';
        }
        
    } catch (error) {
        console.error('DEBUG: Error in exitFullscreen:', error);
        // フォールバック
        console.log('DEBUG: Fallback navigation');
        window.location.href = '/';
    }
    
    console.log('DEBUG: ========== exitFullscreen() END ==========');
}

// 黒板表示切替
function toggleBlackboard() {
    blackboardVisible = !blackboardVisible;
    const overlay = document.getElementById('blackboardOverlay');
    overlay.style.display = blackboardVisible ? 'block' : 'none';
}

// 黒板編集パネル切替
function toggleBlackboardEdit() {
    const editPanel = document.getElementById('blackboardEditPanel');
    editPanel.classList.toggle('open');
}

// 画質調整パネル切替
function toggleQualityPanel() {
    const qualityPanel = document.getElementById('qualityPanel');
    qualityPanel.classList.toggle('open');
}

// メニューを閉じる
function closeMenus() {
    const editPanel = document.getElementById('blackboardEditPanel');
    const qualityPanel = document.getElementById('qualityPanel');
    
    editPanel.classList.remove('open');
    qualityPanel.classList.remove('open');
}

// グリッド表示切替
function toggleGrid() {
    gridVisible = !gridVisible;
    const grid = document.getElementById('cameraGrid');
    grid.style.display = gridVisible ? 'block' : 'none';
}

// タイマー撮影
function toggleTimer() {
    if (timerActive) return;
    
    timerActive = true;
    const timerDisplay = document.getElementById('timerDisplay');
    const timerCount = timerDisplay.querySelector('.timer-count');
    
    timerDisplay.style.display = 'flex';
    
    let count = 3;
    timerCount.textContent = count;
    
    const countdown = setInterval(() => {
        count--;
        if (count > 0) {
            timerCount.textContent = count;
        } else {
            clearInterval(countdown);
            timerDisplay.style.display = 'none';
            capturePhoto();
            timerActive = false;
        }
    }, 1000);
}

// 黒板内容更新
function updateBlackboard() {
    document.getElementById('surveyNumber').textContent = document.getElementById('surveyNumberInput').value || '-';
    document.getElementById('buildingNumber').textContent = document.getElementById('buildingNumberInput').value || '-';
    document.getElementById('owner').textContent = document.getElementById('ownerInput').value || '-';
    document.getElementById('damageType').textContent = document.getElementById('damageTypeInput').value || '-';
    document.getElementById('damageSize').textContent = document.getElementById('damageSizeInput').value || '-';
    document.getElementById('damageLocation').textContent = document.getElementById('damageLocationInput').value || '-';
    document.getElementById('photoNumber').textContent = document.getElementById('photoNumberInput').value || '-';
}

// 写真番号自動採番（連番）
async function generatePhotoNumber() {
    try {
        // プロジェクトとサブプロジェクトのIDを取得
        const projectId = document.getElementById('projectSelect').value;
        const subprojectId = document.getElementById('subprojectSelect').value;
        
        if (!projectId) {
            // プロジェクトが選択されていない場合は1から開始
            document.getElementById('photoNumberInput').value = '1';
            updateBlackboard();
            return;
        }
        
        // 既存の写真数を取得してAPIで確認
        let apiUrl = `/api/photos/project/${projectId}`;
        if (subprojectId) {
            apiUrl = `/api/photos/subproject/${subprojectId}`;
        }
        
        const response = await fetch(apiUrl);
        if (response.ok) {
            const photos = await response.json();
            const nextNumber = photos.length + 1;
            document.getElementById('photoNumberInput').value = nextNumber.toString();
        } else {
            // APIエラーの場合は1から開始
            document.getElementById('photoNumberInput').value = '1';
        }
        
        updateBlackboard();
        
    } catch (error) {
        console.error('写真番号生成エラー:', error);
        // エラーの場合は1から開始
        document.getElementById('photoNumberInput').value = '1';
        updateBlackboard();
    }
}

// 写真撮影
function capturePhoto() {
    console.log('DEBUG: capturePhoto() called');
    
    const video = document.getElementById('cameraVideo');
    console.log('DEBUG: Video element found:', !!video);
    
    if (!video) {
        console.error('DEBUG: Video element not found');
        return;
    }
    
    console.log('DEBUG: Video state - readyState:', video.readyState, 'videoWidth:', video.videoWidth, 'videoHeight:', video.videoHeight);
    console.log('DEBUG: Current stream state:', currentStream ? 'active' : 'null');
    
    if (currentStream) {
        const tracks = currentStream.getTracks();
        console.log('DEBUG: Stream tracks count:', tracks.length);
        tracks.forEach((track, index) => {
            console.log(`DEBUG: Track ${index}: kind=${track.kind}, readyState=${track.readyState}, enabled=${track.enabled}`);
        });
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('DEBUG: Video dimensions are zero - cannot capture');
        alert('カメラの映像が正常に表示されていません。もう一度お試しください。');
        return;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log('DEBUG: Canvas dimensions set to:', canvas.width, 'x', canvas.height);
    
    try {
        // ビデオフレームを描画
        ctx.drawImage(video, 0, 0);
        console.log('DEBUG: Video frame drawn to canvas');
        
        // 黒板が表示されている場合、オーバーレイを合成
        if (blackboardVisible) {
            console.log('DEBUG: Drawing blackboard overlay');
            drawBlackboardOnCanvas(ctx, canvas.width, canvas.height);
        }
        
        // 結果を表示
        capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
        console.log('DEBUG: Image data captured, size:', capturedImageData.length, 'bytes');
        
        document.getElementById('capturedImage').src = capturedImageData;
        document.getElementById('captureResult').style.display = 'flex';
        console.log('DEBUG: Capture result displayed');
        
        // 撮影音効果（オプション）
        playShutterSound();
        
        // ストリームの状態を再確認して必要に応じて復旧
        setTimeout(async () => {
            console.log('DEBUG: Post-capture stream check');
            const isStreamActive = checkCameraStreamStatus();
            
            if (!isStreamActive) {
                console.log('DEBUG: Stream stopped after capture, attempting recovery...');
                
                // まずビデオの再生を試す
                const video = document.getElementById('cameraVideo');
                if (currentStream && video && video.paused) {
                    console.log('DEBUG: Post-capture attempting to resume paused video');
                    try {
                        await video.play();
                        console.log('DEBUG: Post-capture video resumed successfully');
                        return;
                    } catch (playError) {
                        console.error('DEBUG: Post-capture failed to resume video:', playError);
                    }
                }
                
                // ビデオ再生が失敗した場合、カメラを再初期化
                try {
                    await initCamera();
                    console.log('DEBUG: Post-capture stream recovery successful');
                } catch (error) {
                    console.error('DEBUG: Post-capture stream recovery failed:', error);
                }
            } else {
                console.log('DEBUG: Stream is still working after capture');
            }
        }, 500);
        
    } catch (error) {
        console.error('DEBUG: Error during photo capture:', error);
        alert('写真の撮影中にエラーが発生しました: ' + error.message);
    }
}

// 黒板をcanvasに描画
function drawBlackboardOnCanvas(ctx, canvasWidth, canvasHeight) {
    const blackboard = document.getElementById('blackboardOverlay');
    const rect = blackboard.getBoundingClientRect();
    const videoRect = document.getElementById('cameraVideo').getBoundingClientRect();
    
    // 黒板の位置とサイズを計算
    const scaleX = canvasWidth / videoRect.width;
    const scaleY = canvasHeight / videoRect.height;
    
    const x = (rect.left - videoRect.left) * scaleX;
    const y = (rect.top - videoRect.top) * scaleY;
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;
    
    // 背景を描画
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // テキストを描画
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    
    const table = blackboard.querySelector('.blackboard-table');
    const rows = table.querySelectorAll('tr');
    
    let currentY = y + 20;
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        let currentX = x + 10;
        
        cells.forEach(cell => {
            const text = cell.textContent.trim();
            if (text) {
                ctx.fillText(text, currentX, currentY);
                currentX += 100; // セル幅
            }
        });
        
        currentY += 20; // 行高
    });
}

// 撮影音効果
function playShutterSound() {
    // Web Audio APIを使った簡易的な撮影音
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.log('撮影音の再生に失敗しました:', error);
    }
}

// 写真の保存
async function savePhoto() {
    if (!capturedImageData) {
        alert('保存する写真がありません');
        return;
    }
    
    const projectId = document.getElementById('projectSelect').value;
    const subprojectId = document.getElementById('subprojectSelect').value;
    
    if (!projectId) {
        alert('プロジェクトを選択してください');
        return;
    }
    
    try {
        // 保存ボタンを無効化
        const saveButton = document.querySelector('button[onclick="savePhoto()"]');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }
        
        // Base64データをBlobに変換
        const response = await fetch(capturedImageData);
        const blob = await response.blob();
        
        // FormDataを作成
        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');
        formData.append('project_id', projectId);
        if (subprojectId) {
            formData.append('subproject_id', subprojectId);
        }
        
        // 黒板データも送信（デフォルトフィールドまたは動的フィールドから）
        const blackboardData = getBlackboardData();
        if (blackboardData) {
            formData.append('blackboard_data', JSON.stringify(blackboardData));
        }
        
        // APIに送信
        const uploadResponse = await fetch('/api/photos/upload', {
            method: 'POST',
            body: formData
        });
        
        if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            alert('写真が保存されました');
            retakePhoto();
            generatePhotoNumber(); // 次の撮影用に新しい番号を生成
        } else {
            const errorText = await uploadResponse.text();
            console.error('Server error:', errorText);
            throw new Error(`写真の保存に失敗しました (${uploadResponse.status})`);
        }
        
    } catch (error) {
        console.error('写真保存エラー:', error);
        alert(`写真の保存に失敗しました: ${error.message}`);
    } finally {
        // 保存ボタンを復元
        const saveButton = document.querySelector('button[onclick="savePhoto()"]');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> 保存';
        }
    }
}

// 黒板データを取得（デフォルトフィールドまたは動的フィールドから）
function getBlackboardData() {
    // デフォルトフィールドが表示されている場合
    const defaultContainer = document.getElementById('defaultEditFields');
    if (defaultContainer && defaultContainer.style.display !== 'none') {
        return {
            survey_number: document.getElementById('surveyNumberInput')?.value || '',
            building_number: document.getElementById('buildingNumberInput')?.value || '',
            owner: document.getElementById('ownerInput')?.value || '',
            damage_type: document.getElementById('damageTypeInput')?.value || '',
            damage_size: document.getElementById('damageSizeInput')?.value || '',
            damage_location: document.getElementById('damageLocationInput')?.value || '',
            photo_number: document.getElementById('photoNumberInput')?.value || ''
        };
    }
    
    // 動的フィールドが表示されている場合
    const dynamicContainer = document.getElementById('dynamicEditFields');
    if (dynamicContainer && dynamicContainer.style.display !== 'none') {
        const dynamicData = {};
        const dynamicFields = dynamicContainer.querySelectorAll('input, select, textarea');
        
        dynamicFields.forEach(field => {
            const cellId = field.dataset.cellId;
            const cellAddress = field.dataset.cellAddress;
            if (cellId || cellAddress) {
                dynamicData[cellId || cellAddress] = field.value || '';
            }
        });
        
        return dynamicData;
    }
    
    return null;
}

// 再撮影
async function retakePhoto() {
    console.log('DEBUG: retakePhoto() called');
    
    document.getElementById('captureResult').style.display = 'none';
    capturedImageData = null;
    
    console.log('DEBUG: Capture result hidden, checking camera stream');
    
    // カメラストリームの状態を詳細に確認
    const video = document.getElementById('cameraVideo');
    const isStreamActive = checkCameraStreamStatus();
    
    console.log('DEBUG: Stream status check result:', isStreamActive);
    
    if (!isStreamActive) {
        console.log('DEBUG: Camera stream appears to be lost or paused, attempting recovery...');
        
        // まずビデオの再生を試す（ストリームが生きている場合）
        if (currentStream && video && video.paused) {
            console.log('DEBUG: Attempting to resume paused video');
            try {
                await video.play();
                console.log('DEBUG: Video playback resumed successfully');
                return; // 成功したら終了
            } catch (playError) {
                console.error('DEBUG: Failed to resume video playback:', playError);
            }
        }
        
        // ビデオ再生が失敗した場合、カメラを再初期化
        console.log('DEBUG: Reinitializing camera...');
        try {
            await initCamera();
            console.log('DEBUG: Camera reinitialization successful');
        } catch (error) {
            console.error('DEBUG: Failed to reinitialize camera:', error);
            alert('カメラの再初期化に失敗しました。ページを更新してください。');
        }
    } else {
        console.log('DEBUG: Camera stream is active and working properly');
    }
}

// カメラストリームの状態を詳細にチェック
function checkCameraStreamStatus() {
    // ログ出力を最小限に抑制（テンプレートデバッグ優先）
    
    const video = document.getElementById('cameraVideo');
    
    // 基本的なチェック
    if (!video) {
        return false;
    }
    
    if (!video.srcObject) {
        return false;
    }
    
    if (!currentStream) {
        return false;
    }
    
    // ストリームのトラック状態をチェック
    const tracks = currentStream.getTracks();
    
    let activeTrackCount = 0;
    tracks.forEach((track, index) => {
        if (track.readyState === 'live' && track.enabled) {
            activeTrackCount++;
        }
    });
    
    // ストリームが実際に動作しているかの判定
    const isStreamWorking = (
        activeTrackCount > 0 && 
        video.readyState >= 3 && // HAVE_FUTURE_DATA以上
        video.videoWidth > 0 && 
        video.videoHeight > 0 &&
        !video.ended &&
        !video.paused // pausedもチェック
    );
    
    // エラー時のみログ出力
    if (!isStreamWorking) {
        console.log('STREAM: カメラストリームに問題があります - 復旧を試行中...');
    }
    
    return isStreamWorking;
}

// 黒板のドラッグ機能設定
function setupBlackboardDrag() {
    const blackboard = document.getElementById('blackboardOverlay');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let touchStartTime = 0;
    
    
    blackboard.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(window.getComputedStyle(blackboard).left, 10);
        startTop = parseInt(window.getComputedStyle(blackboard).top, 10);
        
        blackboard.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const x = e.clientX - startX;
        const y = e.clientY - startY;
        const newLeft = startLeft + x;
        const newTop = startTop + y;
        
        blackboard.style.left = newLeft + 'px';
        blackboard.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        blackboard.style.cursor = 'move';
    });
    
    // タッチイベント（モバイル対応）- 改善されたiPad対応
    blackboard.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        isDragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = parseInt(window.getComputedStyle(blackboard).left, 10);
        startTop = parseInt(window.getComputedStyle(blackboard).top, 10);
        touchStartTime = Date.now();
        
        // タッチ開始時にページのスクロールを防ぐ
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        // すべてのタッチ移動でページの動作を無効化
        e.preventDefault();
        e.stopPropagation();
        
        const touch = e.touches[0];
        const x = touch.clientX - startX;
        const y = touch.clientY - startY;
        
        blackboard.style.left = (startLeft + x) + 'px';
        blackboard.style.top = (startTop + y) + 'px';
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        if (isDragging) {
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            
            // 短時間のタッチの場合はクリックとみなす
            if (touchDuration < 150) {
                // クリック動作（必要に応じて）
                console.log('短時間タッチ（クリック）');
            }
            
            isDragging = false;
            
            // イベントの伝播を停止
            e.preventDefault();
            e.stopPropagation();
        }
    }, { passive: false });
    
    // 黒板領域外のタッチによるページ更新防止
    blackboard.addEventListener('touchcancel', (e) => {
        isDragging = false;
        e.preventDefault();
        e.stopPropagation();
    }, { passive: false });
}

// iPad対応のタッチ防止設定
function setupIPadTouchPrevention() {
    // pull-to-refresh の無効化
    let startY = 0;
    let preventPullToRefresh = false;
    
    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        preventPullToRefresh = window.scrollY === 0;
    });
    
    document.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        const distance = currentY - startY;
        
        // 画面上部でのスワイプダウン（リフレッシュ）を防ぐ
        if (preventPullToRefresh && distance > 0) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // 特定の範囲でのスクロール防止
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) {
        cameraContainer.addEventListener('touchmove', (e) => {
            // カメラコンテナ内でのスクロールを完全に無効化
            e.preventDefault();
        }, { passive: false });
    }
    
    // 画面上端からの下方向スワイプを検出して防止
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        if (touch.clientY < 50) { // 画面上端から50px以内
            const moveHandler = (moveEvent) => {
                const moveTouch = moveEvent.touches[0];
                const deltaY = moveTouch.clientY - touch.clientY;
                
                // 下方向への移動を検出
                if (deltaY > 0) {
                    moveEvent.preventDefault();
                }
            };
            
            const endHandler = () => {
                document.removeEventListener('touchmove', moveHandler);
                document.removeEventListener('touchend', endHandler);
            };
            
            document.addEventListener('touchmove', moveHandler, { passive: false });
            document.addEventListener('touchend', endHandler);
        }
    });
}

// ストリーム監視機能
let streamMonitorInterval = null;

function startStreamMonitoring() {
    // ログ出力を最小限に抑制（テンプレートデバッグ優先）
    
    // 既存の監視を停止
    if (streamMonitorInterval) {
        clearInterval(streamMonitorInterval);
    }
    
    // 5秒ごとにストリーム状態をチェック（頻度を下げてログを減らす）
    streamMonitorInterval = setInterval(() => {
        // 撮影結果表示中は監視を一時停止
        const captureResult = document.getElementById('captureResult');
        if (captureResult && captureResult.style.display !== 'none') {
            return;
        }
        
        const isStreamActive = checkCameraStreamStatus();
        if (!isStreamActive) {
            // まずビデオの再生を試す
            const video = document.getElementById('cameraVideo');
            if (currentStream && video && video.paused) {
                video.play().then(() => {
                    console.log('STREAM: ビデオ再生を復旧しました');
                }).catch(playError => {
                    console.log('STREAM: カメラを再初期化中...');
                    initCamera().catch(error => {
                        console.error('STREAM: 復旧に失敗:', error);
                    });
                });
            } else {
                // カメラを再初期化
                initCamera().catch(error => {
                    console.error('STREAM: 復旧に失敗:', error);
                });
            }
        }
    }, 5000);
}

function stopStreamMonitoring() {
    if (streamMonitorInterval) {
        clearInterval(streamMonitorInterval);
        streamMonitorInterval = null;
    }
}

// プロジェクト一覧の読み込み
async function loadProjects() {
    try {
        const response = await fetch('/api/projects/');
        const projects = await response.json();
        
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">プロジェクトを選択...</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });
        
        return Promise.resolve();
    } catch (error) {
        console.error('プロジェクトの読み込みに失敗しました:', error);
        return Promise.reject(error);
    }
}

// サブプロジェクト一覧の読み込み
async function loadSubprojects() {
    try {
        const projectId = document.getElementById('projectSelect').value;
        const select = document.getElementById('subprojectSelect');
        
        select.innerHTML = '<option value="">エリアを選択...</option>';
        
        if (!projectId) {
            return Promise.resolve();
        }
        
        const response = await fetch(`/api/projects/${projectId}/subprojects`);
        const subprojects = await response.json();
        
        subprojects.forEach(subproject => {
            const option = document.createElement('option');
            option.value = subproject.id;
            option.textContent = subproject.name;
            select.appendChild(option);
        });
        
        return Promise.resolve();
    } catch (error) {
        console.error('サブプロジェクトの読み込みに失敗しました:', error);
        return Promise.reject(error);
    }
}

// テンプレート一覧の読み込み
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates/');
        const templates = await response.json();
        
        const select = document.getElementById('templateSelect');
        select.innerHTML = '<option value="">テンプレートを選択...</option>';
        
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            select.appendChild(option);
        });
        
        // テンプレート選択時のイベントリスナーを追加
        select.addEventListener('change', applyTemplate);
        
        return Promise.resolve();
    } catch (error) {
        console.error('テンプレートの読み込みに失敗しました:', error);
        return Promise.reject(error);
    }
}

// テンプレート適用
async function applyTemplate() {
    const templateId = document.getElementById('templateSelect').value;
    
    console.log('🔧 TEMPLATE: === applyTemplate 開始 ===');
    console.log('🔧 TEMPLATE: 選択されたテンプレートID:', templateId);
    
    if (!templateId) {
        // テンプレートがクリアされた場合、黒板を初期状態に戻す
        console.log('🔧 TEMPLATE: テンプレートがクリアされたため、初期状態に戻します');
        resetBlackboardToDefault();
        return;
    }
    
    try {
        console.log('🔧 TEMPLATE: テンプレートデータを取得中...');
        const response = await fetch(`/api/templates/${templateId}`);
        const template = await response.json();
        
        console.log('🔧 TEMPLATE: 取得したテンプレートデータ:', template);
        console.log('🔧 TEMPLATE: template.cell_data:', template.cell_data);
        console.log('🔧 TEMPLATE: template.layout_config:', template.layout_config);
        
        // テンプレートデータから黒板を更新
        updateBlackboardFromTemplate(template);
        
        console.log('🔧 TEMPLATE: === applyTemplate 完了 ===');
        
    } catch (error) {
        console.error('テンプレートの適用に失敗しました:', error);
        alert('テンプレートの適用に失敗しました');
    }
}

// テンプレートから黒板を更新
function updateBlackboardFromTemplate(template) {
    console.log('🔧 TEMPLATE: === updateBlackboardFromTemplate 開始 ===');
    console.log('🔧 TEMPLATE: template引数:', template);
    
    try {
        // テンプレートデータがある場合は、テンプレートレイアウトを適用
        if (template.cell_data && template.layout_config) {
            console.log('🔧 TEMPLATE: セルデータとレイアウト設定が存在します - フルテンプレートを適用');
            console.log('🔧 TEMPLATE: cell_data内容:', template.cell_data);
            console.log('🔧 TEMPLATE: layout_config内容:', template.layout_config);
            
            generateBlackboardFromTemplate(template);
            // 入力フィールドも動的に生成
            generateDynamicInputFields(template);
        } else {
            console.log('🔧 TEMPLATE: セルデータまたはレイアウト設定が不足 - 基本設定を適用');
            console.log('🔧 TEMPLATE: cell_data存在:', !!template.cell_data);
            console.log('🔧 TEMPLATE: layout_config存在:', !!template.layout_config);
            // フォールバック: 基本的な設定のみ適用
            applyBasicTemplateSettings(template);
        }
        console.log('🔧 TEMPLATE: === updateBlackboardFromTemplate 完了 ===');
    } catch (error) {
        console.error('テンプレートの適用に失敗しました:', error);
        console.error('ERROR スタックトレース:', error.stack);
        applyBasicTemplateSettings(template);
    }
}

// テンプレートから黒板レイアウトを生成
function generateBlackboardFromTemplate(template) {
    console.log('🔧 TEMPLATE: === generateBlackboardFromTemplate 開始 ===');
    console.log('🔧 TEMPLATE: 受信したテンプレートオブジェクト全体:', template);
    
    try {
        const layoutConfig = JSON.parse(template.layout_config || '{}');
        const cellTypes = layoutConfig.cell_types || {};
        const cellSizes = layoutConfig.cell_sizes || {};
        const cellStyles = template.cell_styles ? JSON.parse(template.cell_styles) : {};
        const mergedCells = template.merged_cells ? JSON.parse(template.merged_cells) : [];
        
        // 黒板テーブルを取得
        const blackboard = document.getElementById('blackboardOverlay');
        const blackboardTable = blackboard.querySelector('.blackboard-table');
        
        // テンプレートのデフォルトサイズを黒板オーバーレイに適用
        if (template.default_width && template.default_height) {
            blackboard.style.width = template.default_width + 'px';
            blackboard.style.height = template.default_height + 'px';
            blackboardTable.style.width = template.default_width + 'px';
            blackboardTable.style.height = template.default_height + 'px';
            console.log('🔧 TEMPLATE: 黒板サイズ設定:', {
                width: template.default_width + 'px',
                height: template.default_height + 'px'
            });
        }
        
        // CSS Grid構造を生成（Excel風レイアウト）
        blackboardTable.innerHTML = '';
        
        const maxRow = layoutConfig.max_row || 8;
        const maxCol = layoutConfig.max_col || 6;
        
        // Grid templateを動的に設定
        const gridTemplateColumns = [];
        for (let col = 0; col < maxCol; col++) {
            // 各列の幅を計算（最初の行のセルサイズを基準）
            const cellId = `0-${col}`;
            const width = (cellSizes[cellId] && cellSizes[cellId].width) ? cellSizes[cellId].width + 'px' : '80px';
            gridTemplateColumns.push(width);
        }
        
        const gridTemplateRows = [];
        for (let row = 0; row < maxRow; row++) {
            // 各行の高さを計算（最初の列のセルサイズを基準）
            const cellId = `${row}-0`;
            const height = (cellSizes[cellId] && cellSizes[cellId].height) ? cellSizes[cellId].height + 'px' : '30px';
            gridTemplateRows.push(height);
        }
        
        blackboardTable.style.gridTemplateColumns = gridTemplateColumns.join(' ');
        blackboardTable.style.gridTemplateRows = gridTemplateRows.join(' ');
        
        console.log('🔧 GRID_DEBUG: Grid template設定:', {
            columns: gridTemplateColumns,
            rows: gridTemplateRows
        });
        
        // セルを生成
        for (let row = 0; row < maxRow; row++) {
            for (let col = 0; col < maxCol; col++) {
                const cellId = `${row}-${col}`;
                const cellType = cellTypes[cellId] || 'fixed';
                
                const cell = document.createElement('div');
                cell.className = cellType === 'fixed' ? 'blackboard-cell header' : 'blackboard-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.dataset.cellId = cellId;
                
                // Grid位置を設定
                cell.style.gridColumn = col + 1;
                cell.style.gridRow = row + 1;
                
                // セルの内容を設定
                if (template.cellData && template.cellData[cellId]) {
                    const data = template.cellData[cellId];
                    cell.textContent = data.text || '';
                    if (data.style) {
                        Object.assign(cell.style, data.style);
                    }
                    if (data.className) {
                        cell.className += ' ' + data.className;
                    }
                }
                
                // Excel形式のcell_dataから内容を取得
                const cellData = JSON.parse(template.cell_data || '{}');
                const excelAddress = convertToExcelAddress(row, col);
                if (cellData[excelAddress]) {
                    cell.textContent = cellData[excelAddress];
                }
                
                // セルスタイルを適用
                if (cellStyles[cellId]) {
                    const styleData = cellStyles[cellId];
                    if (styleData.style) {
                        cell.style.cssText += '; ' + styleData.style;
                    }
                    if (styleData.className) {
                        cell.className = styleData.className;
                    }
                }
                
                // 可変セルの場合はデフォルトテキスト
                if (cellType === 'variable') {
                    if (!cell.textContent) cell.textContent = '-';
                }
                
                // セルに内容があるか、可変セルの場合のみ表示
                if (cell.textContent || cellType === 'variable') {
                    blackboardTable.appendChild(cell);
                }
            }
        }
        
        // 結合セルを処理
        if (mergedCells && mergedCells.length > 0) {
            console.log('🔧 TEMPLATE: 結合セル処理開始:', mergedCells);
            applyMergedCells(blackboardTable, mergedCells, cellSizes);
        }
        
        console.debug('テンプレートから黒板レイアウトを生成しました');
        
    } catch (error) {
        console.error('黒板レイアウト生成エラー:', error);
        resetBlackboardToDefault();
    }
}

// セルデータをグリッド形式に整理
function organizeGridData(cellData, layoutConfig) {
    console.log('🔧 TEMPLATE: === organizeGridData 開始 ===');
    console.log('🔧 TEMPLATE: cellData引数:', cellData);
    console.log('🔧 TEMPLATE: layoutConfig引数:', layoutConfig);
    
    const maxRow = layoutConfig.max_row || 8;
    const maxCol = layoutConfig.max_col || 6;
    const gridData = [];
    
    console.log('🔧 TEMPLATE: グリッドサイズ:', { maxRow, maxCol });
    
    // グリッドを初期化
    for (let row = 0; row < maxRow; row++) {
        gridData[row] = [];
        for (let col = 0; col < maxCol; col++) {
            const address = convertToExcelAddress(row, col);
            const cellText = cellData[address] || '';
            gridData[row][col] = {
                text: cellText,
                address: address
            };
            
            if (cellText) {
                console.log(`🔧 TEMPLATE: セルデータ発見 [${row},${col}] ${address} = "${cellText}"`);
            }
        }
    }
    
    console.log('🔧 TEMPLATE: 整理されたグリッドデータ:', gridData);
    console.log('🔧 TEMPLATE: === organizeGridData 完了 ===');
    return gridData;
}

// テンプレートに基づいて動的に入力フィールドを生成
function generateDynamicInputFields(template) {
    console.log('🔧 TEMPLATE: === generateDynamicInputFields 開始 ===');
    console.log('🔧 TEMPLATE: template引数:', template);
    
    try {
        console.log('🔧 TEMPLATE: JSONパース開始...');
        const cellData = JSON.parse(template.cell_data || '{}');
        const cellStyles = JSON.parse(template.cell_styles || '{}');
        const layoutConfig = JSON.parse(template.layout_config || '{}');
        
        console.log('🔧 TEMPLATE: パース結果:');
        console.log('  - cellData:', cellData);
        console.log('  - cellStyles:', cellStyles);
        console.log('  - layoutConfig:', layoutConfig);
        
        // セルタイプとセル設定データを取得
        const cellTypes = layoutConfig.cell_types || {};
        const cellConfigs = layoutConfig.cell_configs || {};
        
        console.log('🔧 TEMPLATE: セル設定:');
        console.log('  - cellTypes:', cellTypes);
        console.log('  - cellConfigs:', cellConfigs);
        
        // 動的フィールドコンテナを取得
        const dynamicContainer = document.getElementById('dynamicEditFields');
        const defaultContainer = document.getElementById('defaultEditFields');
        
        console.log('🔧 TEMPLATE: フィールドコンテナ:');
        console.log('  - dynamicContainer:', !!dynamicContainer);
        console.log('  - defaultContainer:', !!defaultContainer);
        
        // 既存の動的フィールドを削除
        dynamicContainer.innerHTML = '';
        console.log('🔧 TEMPLATE: 既存の動的フィールドをクリア完了');
        
        // 可変セルからフィールドを生成
        console.log('🔧 TEMPLATE: 可変セルからフィールドを生成中...');
        const inputFields = generateFieldsFromTemplate(cellData, cellTypes, cellConfigs);
        console.log('🔧 TEMPLATE: 生成されたフィールド:', inputFields);
        
        if (inputFields.length > 0) {
            console.log('🔧 TEMPLATE: テンプレートの可変セルが見つかりました:', inputFields.length, '個');
            // テンプレートの可変セルがある場合
            defaultContainer.style.display = 'none';
            dynamicContainer.style.display = 'block';
            
            console.log('🔧 TEMPLATE: デフォルトフィールドを非表示、動的フィールドを表示');
            
            // 動的フィールドを生成
            inputFields.forEach((fieldInfo, index) => {
                console.log(`🔧 TEMPLATE: フィールド生成中 [${index}]:`, fieldInfo);
                const fieldGroup = createDynamicInputField(fieldInfo, index);
                fieldGroup.classList.remove('dynamic-field'); // 元のクラスを削除
                fieldGroup.classList.add('template-field'); // 新しいクラスを追加
                dynamicContainer.appendChild(fieldGroup);
                console.log(`🔧 TEMPLATE: フィールド ${index} を追加完了`);
            });
            
            console.log('🔧 TEMPLATE: テンプレート用動的フィールドを生成しました:', inputFields.length, '個');
        } else {
            console.log('🔧 TEMPLATE: 可変セルが見つからないため、デフォルトフィールドを表示');
            // 可変セルがない場合はデフォルトフィールドを表示
            showDefaultEditFields();
        }
        
        console.log('🔧 TEMPLATE: === generateDynamicInputFields 完了 ===');
        
    } catch (error) {
        console.error('🔧 TEMPLATE ERROR: 動的入力フィールドの生成に失敗しました:', error);
        console.error('🔧 TEMPLATE ERROR: エラースタックトレース:', error.stack);
        showDefaultEditFields();
    }
}

// デフォルトの編集フィールドを表示
function showDefaultEditFields() {
    const dynamicContainer = document.getElementById('dynamicEditFields');
    const defaultContainer = document.getElementById('defaultEditFields');
    
    dynamicContainer.style.display = 'none';
    dynamicContainer.innerHTML = '';
    defaultContainer.style.display = 'block';
    
    console.debug('デフォルト編集フィールドを表示');
}

// テンプレートからフィールドを生成（新しいセルタイプシステム対応）
function generateFieldsFromTemplate(cellData, cellTypes, cellConfigs) {
    console.log('=== DEBUG: generateFieldsFromTemplate 開始 ===');
    console.log('DEBUG: cellData:', cellData);
    console.log('DEBUG: cellTypes:', cellTypes);
    console.log('DEBUG: cellConfigs:', cellConfigs);
    
    const inputFields = [];
    
    console.log('DEBUG: cellTypesのエントリー数:', Object.entries(cellTypes).length);
    
    // 可変セル（variable）のみからフィールドを生成
    Object.entries(cellTypes).forEach(([cellId, cellType]) => {
        console.log(`DEBUG: セル処理中 - cellId: ${cellId}, cellType: ${cellType}`);
        
        if (cellType === 'variable') {
            console.log(`DEBUG: 可変セルを発見: ${cellId}`);
            
            // セルIDから座標を取得 (例: "0-1" -> row=0, col=1)
            const [row, col] = cellId.split('-').map(Number);
            const excelAddress = convertToExcelAddress(row, col);
            
            console.log(`DEBUG: 座標変換 - cellId: ${cellId} -> row: ${row}, col: ${col}, address: ${excelAddress}`);
            
            // セルのテキスト内容を取得
            const cellText = cellData[excelAddress] || '';
            console.log(`DEBUG: セルテキスト [${excelAddress}]: "${cellText}"`);
            
            // セル設定を取得
            const cellConfig = cellConfigs[cellId] || {};
            const dropdownOptions = cellConfig.options || [];
            const allowOther = cellConfig.allowOther !== false;
            
            console.log(`DEBUG: セル設定 [${cellId}]:`, {
                cellConfig,
                dropdownOptions,
                allowOther
            });
            
            // フィールド名を決定（セルのテキストまたは推測）
            const fieldName = cellText || guessFieldNameFromPosition(row, col, cellData);
            console.log(`DEBUG: フィールド名決定: "${fieldName}"`);
            
            const fieldInfo = {
                cellId: cellId,
                cellAddress: excelAddress,
                fieldName: fieldName,
                currentValue: cellText,
                inputType: dropdownOptions.length > 0 ? 'dropdown' : 'text',
                dropdownOptions: dropdownOptions,
                allowOther: allowOther,
                row: row,
                col: col
            };
            
            console.log(`DEBUG: フィールド情報生成完了 [${cellId}]:`, fieldInfo);
            inputFields.push(fieldInfo);
        } else {
            console.log(`DEBUG: 固定セルをスキップ: ${cellId} (${cellType})`);
        }
    });
    
    console.log('DEBUG: 生成されたフィールド総数:', inputFields.length);
    console.log('DEBUG: 生成されたフィールド一覧:', inputFields);
    console.log('=== DEBUG: generateFieldsFromTemplate 完了 ===');
    
    return inputFields;
}

// 座標からExcelアドレスに変換
function convertToExcelAddress(row, col) {
    const colLetter = String.fromCharCode(65 + col);
    return `${colLetter}${row + 1}`;
}

// 結合セルを適用（CSS Grid版）
function applyMergedCells(table, mergedCells, cellSizes) {
    console.log('🔧 MERGED_CELLS: 結合セル適用開始 (CSS Grid版)');
    
    mergedCells.forEach(mergeInfo => {
        console.log('🔧 MERGED_CELLS: 結合情報:', mergeInfo);
        
        // 結合情報の形式をチェック
        let startRow, startCol, endRow, endCol;
        
        if (Array.isArray(mergeInfo) && mergeInfo.length === 2) {
            // [startCellId, endCellId] 形式
            const [startCellId, endCellId] = mergeInfo;
            [startRow, startCol] = startCellId.split('-').map(Number);
            [endRow, endCol] = endCellId.split('-').map(Number);
        } else if (mergeInfo.range) {
            // {range: "A1:B2"} 形式
            const range = mergeInfo.range;
            const [startAddr, endAddr] = range.split(':');
            const startCoords = excelAddressToCoords(startAddr);
            const endCoords = excelAddressToCoords(endAddr);
            startRow = startCoords.row;
            startCol = startCoords.col;
            endRow = endCoords.row;
            endCol = endCoords.col;
        } else {
            console.warn('🔧 MERGED_CELLS: 不明な結合情報形式:', mergeInfo);
            return;
        }
        
        console.log(`🔧 MERGED_CELLS: 結合セル範囲 [${startRow}-${startCol}] to [${endRow}-${endCol}]`);
        
        // 結合元セルを取得
        const startCell = table.querySelector(`[data-cell-id="${startRow}-${startCol}"]`);
        if (!startCell) {
            console.warn(`🔧 MERGED_CELLS: 開始セルが見つかりません: ${startRow}-${startCol}`);
            return;
        }
        
        // 結合範囲を計算
        const rowSpan = endRow - startRow + 1;
        const colSpan = endCol - startCol + 1;
        
        // CSS Gridで結合セルを設定
        startCell.style.gridColumn = `${startCol + 1} / ${endCol + 2}`;
        startCell.style.gridRow = `${startRow + 1} / ${endRow + 2}`;
        
        console.log(`🔧 MERGED_CELLS: Grid結合設定:`, {
            gridColumn: `${startCol + 1} / ${endCol + 2}`,
            gridRow: `${startRow + 1} / ${endRow + 2}`
        });
        
        // 結合される他のセルを削除
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (r === startRow && c === startCol) continue; // 元セルはスキップ
                
                const cellToRemove = table.querySelector(`[data-cell-id="${r}-${c}"]`);
                if (cellToRemove) {
                    cellToRemove.remove();
                    console.log(`🔧 MERGED_CELLS: セル削除 [${r}-${c}]`);
                }
            }
        }
        
        console.log(`🔧 MERGED_CELLS: 結合セル適用完了 [${startRow}-${startCol}]`);
    });
    
    console.log('🔧 MERGED_CELLS: 全結合セル適用完了');
}

// Excelアドレスを座標に変換
function excelAddressToCoords(address) {
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    
    const colStr = match[1];
    const rowStr = match[2];
    
    // 列文字を数値に変換（A=0, B=1, ...）
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
    }
    col -= 1; // 0ベースに調整
    
    const row = parseInt(rowStr) - 1; // 0ベースに調整
    
    return { row, col };
}

// 位置からフィールド名を推測
function guessFieldNameFromPosition(row, col, cellData) {
    // 左側のセル（ラベル用）をチェック
    if (col > 0) {
        const leftAddress = convertToExcelAddress(row, col - 1);
        if (cellData[leftAddress]) {
            return cellData[leftAddress];
        }
    }
    
    // 上側のセル（ヘッダー用）をチェック
    if (row > 0) {
        const headerAddress = convertToExcelAddress(row - 1, col);
        if (cellData[headerAddress]) {
            return cellData[headerAddress];
        }
    }
    
    // デフォルト名
    return `入力項目${row}-${col}`;
}

// フィールド名を推測
function guessFieldName(cellAddress, cellData) {
    const column = cellAddress.match(/[A-Z]+/)[0];
    const row = parseInt(cellAddress.match(/\d+/)[0]);
    
    // 左側のセル（ラベル用）をチェック
    const leftColumn = String.fromCharCode(column.charCodeAt(0) - 1);
    const leftCellAddress = leftColumn + row;
    if (cellData[leftCellAddress]) {
        return cellData[leftCellAddress];
    }
    
    // 上側のセル（ヘッダー用）をチェック
    const headerCellAddress = column + (row - 1);
    if (cellData[headerCellAddress]) {
        return cellData[headerCellAddress];
    }
    
    // デフォルト名
    return `フィールド${cellAddress}`;
}

// 入力タイプを推測
function guessInputType(fieldName, currentValue) {
    const fieldNameLower = fieldName.toLowerCase();
    
    if (fieldNameLower.includes('日付') || fieldNameLower.includes('date')) {
        return 'date';
    }
    if (fieldNameLower.includes('番号') || fieldNameLower.includes('number')) {
        return 'text';
    }
    if (fieldNameLower.includes('種類') || fieldNameLower.includes('type')) {
        return 'select';
    }
    if (fieldNameLower.includes('備考') || fieldNameLower.includes('comment')) {
        return 'textarea';
    }
    
    return 'text';
}

// 動的入力フィールドを作成
function createDynamicInputField(fieldInfo, index) {
    console.log(`🔧 TEMPLATE: === createDynamicInputField 開始 [${index}] ===`);
    console.log('🔧 TEMPLATE: fieldInfo:', fieldInfo);
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-group dynamic-field';
    
    const label = document.createElement('label');
    label.textContent = fieldInfo.fieldName;
    fieldGroup.appendChild(label);
    
    console.log(`🔧 TEMPLATE: ラベル作成完了: "${fieldInfo.fieldName}"`);
    
    let inputElement;
    const fieldId = `dynamicField_${fieldInfo.cellId}`;
    
    console.log(`🔧 TEMPLATE: フィールドID: ${fieldId}`);
    console.log(`🔧 TEMPLATE: 入力タイプ: ${fieldInfo.inputType}`);
    console.log(`🔧 TEMPLATE: ドロップダウンオプション数: ${fieldInfo.dropdownOptions.length}`);
    
    if (fieldInfo.inputType === 'dropdown' && fieldInfo.dropdownOptions.length > 0) {
        console.log('🔧 TEMPLATE: ドロップダウンフィールドを作成中...');
        // ドロップダウンフィールドを作成
        inputElement = document.createElement('select');
        inputElement.className = 'form-control';
        
        // 初期選択肢
        inputElement.innerHTML = '<option value="">選択してください</option>';
        console.log('🔧 TEMPLATE: 初期オプション追加完了');
        
        // テンプレートで設定されたオプションを追加
        fieldInfo.dropdownOptions.forEach((option, optIndex) => {
            console.log(`🔧 TEMPLATE: オプション追加中 [${optIndex}]: "${option}"`);
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            inputElement.appendChild(optionElement);
        });
        
        console.log('🔧 TEMPLATE: 全てのオプション追加完了');
        
        // 「その他」オプションが許可されている場合
        if (fieldInfo.allowOther) {
            console.log('🔧 TEMPLATE: "その他"オプションを追加中...');
            const otherOption = document.createElement('option');
            otherOption.value = '@@other@@';
            otherOption.textContent = 'その他（テキスト入力）';
            inputElement.appendChild(otherOption);
            console.log('🔧 TEMPLATE: "その他"オプション追加完了');
        }
        
        // ドロップダウン変更時のイベント
        inputElement.addEventListener('change', function() {
            console.log(`🔧 TEMPLATE: ドロップダウン変更イベント発生 - 選択値: "${this.value}"`);
            handleDropdownChange(this, fieldInfo);
        });
        
        console.log('🔧 TEMPLATE: ドロップダウンフィールド作成完了');
        
    } else {
        console.log('🔧 TEMPLATE: テキスト入力フィールドを作成中...');
        // 通常のテキスト入力フィールド
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'form-control';
        console.log('🔧 TEMPLATE: テキスト入力フィールド作成完了');
    }
    
    inputElement.id = fieldId;
    inputElement.placeholder = fieldInfo.currentValue || fieldInfo.fieldName;
    inputElement.dataset.cellId = fieldInfo.cellId;
    inputElement.dataset.cellAddress = fieldInfo.cellAddress;
    
    console.log(`🔧 TEMPLATE: フィールド属性設定完了:`);
    console.log(`  - id: ${fieldId}`);
    console.log(`  - placeholder: "${inputElement.placeholder}"`);
    console.log(`  - cellId: ${fieldInfo.cellId}`);
    console.log(`  - cellAddress: ${fieldInfo.cellAddress}`);
    
    // 値が変更された時に黒板を更新
    inputElement.addEventListener('change', function() {
        console.log(`🔧 TEMPLATE: フィールド値変更イベント [${fieldInfo.cellId}]: "${this.value}"`);
        updateDynamicBlackboard();
    });
    inputElement.addEventListener('input', function() {
        console.log(`🔧 TEMPLATE: フィールド入力イベント [${fieldInfo.cellId}]: "${this.value}"`);
        updateDynamicBlackboard();
    });
    
    fieldGroup.appendChild(inputElement);
    
    console.log(`🔧 TEMPLATE: === createDynamicInputField 完了 [${index}] ===`);
    return fieldGroup;
}

// ドロップダウン変更時の処理
function handleDropdownChange(selectElement, fieldInfo) {
    const selectedValue = selectElement.value;
    
    if (selectedValue === '@@other@@') {
        // 「その他」が選択された場合、テキスト入力に切り替え
        const fieldGroup = selectElement.parentElement;
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'form-control';
        textInput.id = selectElement.id;
        textInput.placeholder = 'その他の内容を入力してください';
        textInput.dataset.cellId = selectElement.dataset.cellId;
        textInput.dataset.cellAddress = selectElement.dataset.cellAddress;
        
        // イベントリスナーを追加
        textInput.addEventListener('change', updateDynamicBlackboard);
        textInput.addEventListener('input', updateDynamicBlackboard);
        
        // ドロップダウンに戻るボタンを追加
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.className = 'btn btn-sm btn-outline-secondary mt-1';
        backButton.innerHTML = '<i class="fas fa-arrow-left"></i> ドロップダウンに戻る';
        backButton.onclick = function() {
            // ドロップダウンに戻す
            fieldGroup.removeChild(textInput);
            fieldGroup.removeChild(backButton);
            fieldGroup.appendChild(selectElement);
            selectElement.value = '';
        };
        
        // 要素を入れ替え
        fieldGroup.removeChild(selectElement);
        fieldGroup.appendChild(textInput);
        fieldGroup.appendChild(backButton);
        
        textInput.focus();
    }
    
    // 黒板を更新
    updateDynamicBlackboard();
}

// 動的フィールドの変更を黒板に反映
function updateDynamicBlackboard() {
    console.log('🔧 TEMPLATE: === updateDynamicBlackboard 開始 ===');
    
    // テンプレートフィールドと旧来の動的フィールドの両方をチェック
    const dynamicFields = document.querySelectorAll('.template-field input, .template-field select, .template-field textarea, .dynamic-field input, .dynamic-field select, .dynamic-field textarea');
    
    console.log(`🔧 TEMPLATE: 検出された動的フィールド数: ${dynamicFields.length}`);
    
    dynamicFields.forEach((field, index) => {
        const cellId = field.dataset.cellId;
        const cellAddress = field.dataset.cellAddress;
        const value = field.value;
        
        console.log(`🔧 TEMPLATE: フィールド処理中 [${index}]:`);
        console.log(`  - cellId: ${cellId}`);
        console.log(`  - cellAddress: ${cellAddress}`);
        console.log(`  - value: "${value}"`);
        
        // 黒板の対応するセルを更新
        let blackboardCell = document.querySelector(`[data-cell-id="${cellId}"]`);
        console.log(`🔧 TEMPLATE: data-cell-idでの検索結果:`, !!blackboardCell);
        
        if (!blackboardCell) {
            // セルが見つからない場合、アドレスで検索
            blackboardCell = document.querySelector(`[data-cell="${cellAddress}"]`);
            console.log(`🔧 TEMPLATE: data-cellでの検索結果:`, !!blackboardCell);
        }
        
        if (!blackboardCell) {
            // data-cell-address での検索も試す
            blackboardCell = document.querySelector(`[data-cell-address="${cellAddress}"]`);
            console.log(`🔧 TEMPLATE: data-cell-addressでの検索結果:`, !!blackboardCell);
        }
        
        if (blackboardCell) {
            const displayValue = value || '-';
            console.log(`🔧 TEMPLATE: 黒板セル更新 [${cellId}]: "${displayValue}"`);
            blackboardCell.textContent = displayValue;
            
            // 可変セルのスタイルを維持
            if (blackboardCell.tagName === 'TD' && blackboardCell.style.backgroundColor === 'rgb(240, 248, 255)') {
                blackboardCell.style.backgroundColor = '#f0f8ff';
                blackboardCell.style.border = '2px dashed #007bff';
                blackboardCell.style.fontWeight = 'bold';
            }
        } else {
            console.log(`🔧 TEMPLATE: 黒板セルが見つからない - 動的更新を試行`);
            // 動的に黒板のセルを作成または更新
            updateBlackboardCellDynamically(cellId, cellAddress, value);
        }
    });
    
    console.log('🔧 TEMPLATE: === updateDynamicBlackboard 完了 ===');
}

// 黒板のセルを動的に更新
function updateBlackboardCellDynamically(cellId, cellAddress, value) {
    console.log('🔧 TEMPLATE: === updateBlackboardCellDynamically 開始 ===');
    console.log(`🔧 TEMPLATE: cellId: ${cellId}`);
    console.log(`🔧 TEMPLATE: cellAddress: ${cellAddress}`);
    console.log(`🔧 TEMPLATE: value: "${value}"`);
    
    // 黒板テーブル内の全セルをデバッグ出力
    const blackboardTable = document.querySelector('.blackboard-table');
    if (blackboardTable) {
        const allCells = blackboardTable.querySelectorAll('th, td');
        console.log(`🔧 TEMPLATE: 黒板内の全セル数: ${allCells.length}`);
        
        allCells.forEach((cell, index) => {
            const attrs = {
                'data-cell-id': cell.dataset.cellId,
                'data-cell-address': cell.dataset.cellAddress,
                'data-cell': cell.dataset.cell,
                'id': cell.id,
                'textContent': cell.textContent
            };
            console.log(`🔧 TEMPLATE: セル[${index}]:`, attrs);
        });
        
        // セルIDやアドレスに基づいて該当セルを再検索
        const targetCell = Array.from(allCells).find(cell => 
            cell.dataset.cellId === cellId || 
            cell.dataset.cellAddress === cellAddress ||
            cell.dataset.cell === cellAddress
        );
        
        if (targetCell) {
            console.log(`🔧 TEMPLATE: 対象セルを発見し、更新実行`);
            targetCell.textContent = value || '-';
        } else {
            console.log(`🔧 TEMPLATE: 対象セルが見つからない - セルの動的作成が必要`);
        }
    } else {
        console.log(`🔧 TEMPLATE: 黒板テーブルが見つからない`);
    }
    
    console.log('🔧 TEMPLATE: === updateBlackboardCellDynamically 完了 ===');
}

// 基本的なテンプレート設定を適用
function applyBasicTemplateSettings(template) {
    // 基本的なテンプレート設定の実装
    console.log('基本テンプレート設定を適用:', template.name);
    
    // 黒板を初期状態に戻す
    resetBlackboardToDefault();
}

// 黒板を初期状態に戻す
function resetBlackboardToDefault() {
    const blackboard = document.getElementById('blackboardOverlay');
    const blackboardTable = blackboard.querySelector('.blackboard-table');
    
    // デフォルトのテーブル構造を復元
    blackboardTable.innerHTML = `
        <tr>
            <th>調査番号</th>
            <td id="surveyNumber">-</td>
        </tr>
        <tr>
            <th>建物番号</th>
            <td id="buildingNumber">-</td>
        </tr>
        <tr>
            <th>所有者</th>
            <td id="owner">-</td>
        </tr>
        <tr>
            <th>傷の種類</th>
            <td id="damageType">-</td>
        </tr>
        <tr>
            <th>寸法</th>
            <td id="damageSize">-</td>
        </tr>
        <tr>
            <th>損傷箇所</th>
            <td id="damageLocation">-</td>
        </tr>
        <tr>
            <th>写真番号</th>
            <td id="photoNumber">-</td>
        </tr>
        <tr>
            <th>撮影日</th>
            <td id="dateTaken">-</td>
        </tr>
    `;
    
    // 黒板サイズを初期化
    blackboard.style.width = '';
    blackboard.style.height = '';
    
    // 編集フィールドをデフォルトに戻す
    showDefaultEditFields();
}

// ユーティリティ関数
function numberToColumn(num) {
    let result = '';
    while (num > 0) {
        num--;
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26);
    }
    return result;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}