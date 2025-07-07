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
        const constraints = {
            video: {
                facingMode: currentCamera,
                width: { ideal: currentResolution.width },
                height: { ideal: currentResolution.height }
            }
        };
        
        console.log('DEBUG: Camera constraints:', constraints);
        
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
        
        // ビデオが再生開始されるまで待機
        video.addEventListener('loadedmetadata', () => {
            console.log('DEBUG: Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
        });
        
        video.addEventListener('playing', () => {
            console.log('DEBUG: Video playing started');
        });
        
        video.addEventListener('error', (e) => {
            console.error('DEBUG: Video element error:', e);
        });
        
        // 画質設定を適用
        applyImageFilters();
        
        console.log('DEBUG: Camera initialization completed');
        
    } catch (error) {
        console.error('DEBUG: カメラの初期化に失敗しました:', error);
        alert('カメラの初期化に失敗しました。カメラの使用を許可してください。');
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

// 写真番号自動採番
function generatePhotoNumber() {
    const now = new Date();
    const dateStr = now.getFullYear().toString().slice(-2) + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const timeStr = now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0');
    
    const photoNumber = `${dateStr}-${timeStr}`;
    document.getElementById('photoNumberInput').value = photoNumber;
    updateBlackboard();
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
    console.log('DEBUG: checkCameraStreamStatus() called');
    
    const video = document.getElementById('cameraVideo');
    
    // 基本的なチェック
    if (!video) {
        console.log('DEBUG: Video element not found');
        return false;
    }
    
    if (!video.srcObject) {
        console.log('DEBUG: Video srcObject is null');
        return false;
    }
    
    if (!currentStream) {
        console.log('DEBUG: currentStream is null');
        return false;
    }
    
    // ストリームのトラック状態をチェック
    const tracks = currentStream.getTracks();
    console.log('DEBUG: Stream tracks count:', tracks.length);
    
    let activeTrackCount = 0;
    tracks.forEach((track, index) => {
        console.log(`DEBUG: Track ${index}: kind=${track.kind}, readyState=${track.readyState}, enabled=${track.enabled}`);
        if (track.readyState === 'live' && track.enabled) {
            activeTrackCount++;
        }
    });
    
    console.log('DEBUG: Active tracks count:', activeTrackCount);
    
    // ビデオ要素の状態をチェック
    console.log('DEBUG: Video readyState:', video.readyState);
    console.log('DEBUG: Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    console.log('DEBUG: Video paused:', video.paused);
    console.log('DEBUG: Video ended:', video.ended);
    
    // ストリームが実際に動作しているかの判定
    const isStreamWorking = (
        activeTrackCount > 0 && 
        video.readyState >= 3 && // HAVE_FUTURE_DATA以上
        video.videoWidth > 0 && 
        video.videoHeight > 0 &&
        !video.ended &&
        !video.paused // pausedもチェック
    );
    
    console.log('DEBUG: Stream working status:', isStreamWorking);
    
    // 追加の詳細チェック
    if (!isStreamWorking) {
        console.log('DEBUG: Stream not working reasons:');
        console.log('  - activeTrackCount:', activeTrackCount > 0);
        console.log('  - readyState >= 3:', video.readyState >= 3);
        console.log('  - videoWidth > 0:', video.videoWidth > 0);
        console.log('  - videoHeight > 0:', video.videoHeight > 0);
        console.log('  - not ended:', !video.ended);
        console.log('  - not paused:', !video.paused);
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
        
        blackboard.style.left = (startLeft + x) + 'px';
        blackboard.style.top = (startTop + y) + 'px';
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
    console.log('DEBUG: Starting stream monitoring');
    
    // 既存の監視を停止
    if (streamMonitorInterval) {
        clearInterval(streamMonitorInterval);
    }
    
    // 3秒ごとにストリーム状態をチェック（頻度を上げて迅速に復旧）
    streamMonitorInterval = setInterval(() => {
        // 撮影結果表示中は監視を一時停止
        const captureResult = document.getElementById('captureResult');
        if (captureResult && captureResult.style.display !== 'none') {
            return; // ログを減らすためコメントを削除
        }
        
        const isStreamActive = checkCameraStreamStatus();
        if (!isStreamActive) {
            console.log('DEBUG: Stream monitor detected inactive stream, attempting recovery...');
            
            // まずビデオの再生を試す
            const video = document.getElementById('cameraVideo');
            if (currentStream && video && video.paused) {
                console.log('DEBUG: Monitor attempting to resume paused video');
                video.play().then(() => {
                    console.log('DEBUG: Monitor successfully resumed video');
                }).catch(playError => {
                    console.error('DEBUG: Monitor failed to resume video, reinitializing camera:', playError);
                    initCamera().catch(error => {
                        console.error('DEBUG: Stream monitor recovery failed:', error);
                    });
                });
            } else {
                // カメラを再初期化
                console.log('DEBUG: Monitor reinitializing camera');
                initCamera().catch(error => {
                    console.error('DEBUG: Stream monitor recovery failed:', error);
                });
            }
        }
    }, 3000);
}

function stopStreamMonitoring() {
    console.log('DEBUG: Stopping stream monitoring');
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
    
    if (!templateId) {
        // テンプレートがクリアされた場合、黒板を初期状態に戻す
        resetBlackboardToDefault();
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`);
        const template = await response.json();
        
        // テンプレートデータから黒板を更新
        updateBlackboardFromTemplate(template);
        
    } catch (error) {
        console.error('テンプレートの適用に失敗しました:', error);
        alert('テンプレートの適用に失敗しました');
    }
}

// テンプレートから黒板を更新
function updateBlackboardFromTemplate(template) {
    try {
        // テンプレートデータがある場合は、テンプレートレイアウトを適用
        if (template.cell_data && template.layout_config) {
            generateBlackboardFromTemplate(template);
            // 入力フィールドも動的に生成
            generateDynamicInputFields(template);
        } else {
            // フォールバック: 基本的な設定のみ適用
            applyBasicTemplateSettings(template);
        }
    } catch (error) {
        console.error('テンプレートの適用に失敗しました:', error);
        applyBasicTemplateSettings(template);
    }
}

// テンプレートから黒板レイアウトを生成
function generateBlackboardFromTemplate(template) {
    try {
        const cellData = JSON.parse(template.cell_data || '{}');
        const layoutConfig = JSON.parse(template.layout_config || '{}');
        const cellTypes = layoutConfig.cell_types || {};
        
        // 黒板テーブルを取得
        const blackboard = document.getElementById('blackboardOverlay');
        const blackboardTable = blackboard.querySelector('.blackboard-table');
        
        // 新しいテーブル構造を生成
        blackboardTable.innerHTML = '';
        
        // セルデータをグリッド形式で整理
        const gridData = organizeGridData(cellData, layoutConfig);
        
        // テーブル行を生成
        gridData.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');
            
            rowData.forEach((cellInfo, colIndex) => {
                const cellId = `${rowIndex}-${colIndex}`;
                const cellType = cellTypes[cellId] || 'fixed';
                
                if (cellInfo.text) {
                    const cellElement = document.createElement(cellType === 'fixed' ? 'th' : 'td');
                    cellElement.textContent = cellInfo.text;
                    cellElement.dataset.cellId = cellId;
                    cellElement.dataset.cellAddress = cellInfo.address;
                    
                    // 可変セルの場合は特別なスタイルを適用
                    if (cellType === 'variable') {
                        cellElement.style.backgroundColor = '#f0f8ff';
                        cellElement.style.border = '2px dashed #007bff';
                    }
                    
                    tr.appendChild(cellElement);
                }
            });
            
            if (tr.children.length > 0) {
                blackboardTable.appendChild(tr);
            }
        });
        
        console.debug('テンプレートから黒板レイアウトを生成しました');
        
    } catch (error) {
        console.error('黒板レイアウト生成エラー:', error);
        resetBlackboardToDefault();
    }
}

// セルデータをグリッド形式に整理
function organizeGridData(cellData, layoutConfig) {
    const maxRow = layoutConfig.max_row || 8;
    const maxCol = layoutConfig.max_col || 6;
    const gridData = [];
    
    // グリッドを初期化
    for (let row = 0; row < maxRow; row++) {
        gridData[row] = [];
        for (let col = 0; col < maxCol; col++) {
            const address = convertToExcelAddress(row, col);
            gridData[row][col] = {
                text: cellData[address] || '',
                address: address
            };
        }
    }
    
    return gridData;
}

// テンプレートに基づいて動的に入力フィールドを生成
function generateDynamicInputFields(template) {
    try {
        const cellData = JSON.parse(template.cell_data || '{}');
        const cellStyles = JSON.parse(template.cell_styles || '{}');
        const layoutConfig = JSON.parse(template.layout_config || '{}');
        
        // セルタイプとセル設定データを取得
        const cellTypes = layoutConfig.cell_types || {};
        const cellConfigs = layoutConfig.cell_configs || {};
        
        // 動的フィールドコンテナを取得
        const dynamicContainer = document.getElementById('dynamicEditFields');
        const defaultContainer = document.getElementById('defaultEditFields');
        
        // 既存の動的フィールドを削除
        dynamicContainer.innerHTML = '';
        
        // 可変セルからフィールドを生成
        const inputFields = generateFieldsFromTemplate(cellData, cellTypes, cellConfigs);
        
        if (inputFields.length > 0) {
            // テンプレートの可変セルがある場合
            defaultContainer.style.display = 'none';
            dynamicContainer.style.display = 'block';
            
            // 動的フィールドを生成
            inputFields.forEach((fieldInfo, index) => {
                const fieldGroup = createDynamicInputField(fieldInfo, index);
                fieldGroup.classList.remove('dynamic-field'); // 元のクラスを削除
                fieldGroup.classList.add('template-field'); // 新しいクラスを追加
                dynamicContainer.appendChild(fieldGroup);
            });
            
            console.debug('テンプレート用動的フィールドを生成しました:', inputFields.length, '個');
        } else {
            // 可変セルがない場合はデフォルトフィールドを表示
            showDefaultEditFields();
        }
        
    } catch (error) {
        console.error('動的入力フィールドの生成に失敗しました:', error);
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
    const inputFields = [];
    
    // 可変セル（variable）のみからフィールドを生成
    Object.entries(cellTypes).forEach(([cellId, cellType]) => {
        if (cellType === 'variable') {
            // セルIDから座標を取得 (例: "0-1" -> row=0, col=1)
            const [row, col] = cellId.split('-').map(Number);
            const excelAddress = convertToExcelAddress(row, col);
            
            // セルのテキスト内容を取得
            const cellText = cellData[excelAddress] || '';
            
            // セル設定を取得
            const cellConfig = cellConfigs[cellId] || {};
            const dropdownOptions = cellConfig.options || [];
            const allowOther = cellConfig.allowOther !== false;
            
            // フィールド名を決定（セルのテキストまたは推測）
            const fieldName = cellText || guessFieldNameFromPosition(row, col, cellData);
            
            inputFields.push({
                cellId: cellId,
                cellAddress: excelAddress,
                fieldName: fieldName,
                currentValue: cellText,
                inputType: dropdownOptions.length > 0 ? 'dropdown' : 'text',
                dropdownOptions: dropdownOptions,
                allowOther: allowOther,
                row: row,
                col: col
            });
        }
    });
    
    return inputFields;
}

// 座標からExcelアドレスに変換
function convertToExcelAddress(row, col) {
    const colLetter = String.fromCharCode(65 + col);
    return `${colLetter}${row + 1}`;
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
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-group dynamic-field';
    
    const label = document.createElement('label');
    label.textContent = fieldInfo.fieldName;
    fieldGroup.appendChild(label);
    
    let inputElement;
    const fieldId = `dynamicField_${fieldInfo.cellId}`;
    
    if (fieldInfo.inputType === 'dropdown' && fieldInfo.dropdownOptions.length > 0) {
        // ドロップダウンフィールドを作成
        inputElement = document.createElement('select');
        inputElement.className = 'form-control';
        
        // 初期選択肢
        inputElement.innerHTML = '<option value="">選択してください</option>';
        
        // テンプレートで設定されたオプションを追加
        fieldInfo.dropdownOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            inputElement.appendChild(optionElement);
        });
        
        // 「その他」オプションが許可されている場合
        if (fieldInfo.allowOther) {
            const otherOption = document.createElement('option');
            otherOption.value = '@@other@@';
            otherOption.textContent = 'その他（テキスト入力）';
            inputElement.appendChild(otherOption);
        }
        
        // ドロップダウン変更時のイベント
        inputElement.addEventListener('change', function() {
            handleDropdownChange(this, fieldInfo);
        });
        
    } else {
        // 通常のテキスト入力フィールド
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'form-control';
    }
    
    inputElement.id = fieldId;
    inputElement.placeholder = fieldInfo.currentValue || fieldInfo.fieldName;
    inputElement.dataset.cellId = fieldInfo.cellId;
    inputElement.dataset.cellAddress = fieldInfo.cellAddress;
    
    // 値が変更された時に黒板を更新
    inputElement.addEventListener('change', updateDynamicBlackboard);
    inputElement.addEventListener('input', updateDynamicBlackboard);
    
    fieldGroup.appendChild(inputElement);
    
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
    // テンプレートフィールドと旧来の動的フィールドの両方をチェック
    const dynamicFields = document.querySelectorAll('.template-field input, .template-field select, .template-field textarea, .dynamic-field input, .dynamic-field select, .dynamic-field textarea');
    
    dynamicFields.forEach(field => {
        const cellId = field.dataset.cellId;
        const cellAddress = field.dataset.cellAddress;
        const value = field.value;
        
        // 黒板の対応するセルを更新
        let blackboardCell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (!blackboardCell) {
            // セルが見つからない場合、アドレスで検索
            blackboardCell = document.querySelector(`[data-cell="${cellAddress}"]`);
        }
        
        if (blackboardCell) {
            blackboardCell.textContent = value || '-';
        } else {
            // 動的に黒板のセルを作成または更新
            updateBlackboardCellDynamically(cellId, cellAddress, value);
        }
    });
}

// 黒板のセルを動的に更新
function updateBlackboardCellDynamically(cellId, cellAddress, value) {
    // この関数は、テンプレートベースの黒板レイアウトでセルを更新する
    // 実装は、実際の黒板レイアウト構造によって調整が必要
    console.debug(`黒板セル更新: ${cellId} (${cellAddress}) = ${value}`);
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