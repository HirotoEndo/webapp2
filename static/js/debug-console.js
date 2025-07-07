// デバッグコンソール機能
class DebugConsole {
    constructor() {
        this.logs = [];
        this.isVisible = false;
        this.maxLogs = 200; // ログ数を増やして履歴を確保
        this.autoScroll = true; // 自動スクロールフラグ
        this.init();
    }

    init() {
        this.createConsoleElement();
        this.addToggleButton();
        this.interceptConsole();
    }

    createConsoleElement() {
        // デバッグコンソールのHTML構造を作成
        const consoleHTML = `
            <div id="debugConsole" class="debug-console" style="display: none;">
                <div class="debug-header">
                    <span class="debug-title">🐛 デバッグコンソール</span>
                    <div class="debug-controls">
                        <button onclick="debugConsole.toggleAutoScroll()" class="debug-btn" id="autoScrollBtn">自動スクロール: ON</button>
                        <button onclick="debugConsole.scrollToBottom()" class="debug-btn">↓ 最新へ</button>
                        <button onclick="debugConsole.copyAllLogs()" class="debug-btn">📋 コピー</button>
                        <button onclick="debugConsole.clear()" class="debug-btn">クリア</button>
                        <button onclick="debugConsole.downloadLogs()" class="debug-btn">ダウンロード</button>
                        <button onclick="debugConsole.toggle()" class="debug-btn">×</button>
                    </div>
                </div>
                <div class="debug-content">
                    <div id="debugLogs" class="debug-logs"></div>
                    <div class="debug-input-section">
                        <input type="text" id="debugInput" class="debug-input" placeholder="JavaScriptコードを入力...">
                        <button onclick="debugConsole.executeCommand()" class="debug-btn">実行</button>
                    </div>
                </div>
            </div>
        `;

        // CSSスタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .debug-console {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 400px;
                height: 500px;
                background: rgba(0, 0, 0, 0.95);
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                border: 2px solid #333;
                border-radius: 8px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }

            .debug-header {
                background: #222;
                padding: 8px 12px;
                border-bottom: 1px solid #444;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
            }

            .debug-title {
                font-weight: bold;
                color: #fff;
            }

            .debug-controls {
                display: flex;
                gap: 5px;
            }

            .debug-btn {
                background: #444;
                color: #fff;
                border: 1px solid #666;
                padding: 2px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 10px;
            }

            .debug-btn:hover {
                background: #555;
            }

            .debug-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .debug-logs {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                font-size: 11px;
                line-height: 1.3;
                scroll-behavior: smooth;
                border: 1px solid #444;
                border-radius: 3px;
                background: #111;
            }
            
            .debug-logs::-webkit-scrollbar {
                width: 8px;
            }
            
            .debug-logs::-webkit-scrollbar-track {
                background: #333;
            }
            
            .debug-logs::-webkit-scrollbar-thumb {
                background: #666;
                border-radius: 4px;
            }
            
            .debug-logs::-webkit-scrollbar-thumb:hover {
                background: #888;
            }

            .debug-input-section {
                border-top: 1px solid #444;
                padding: 8px;
                display: flex;
                gap: 5px;
            }

            .debug-input {
                flex: 1;
                background: #222;
                color: #fff;
                border: 1px solid #444;
                padding: 4px 8px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
            }

            .debug-log-entry {
                margin-bottom: 4px;
                padding: 2px 0;
                border-bottom: 1px solid #333;
            }

            .debug-log-time {
                color: #888;
                font-size: 10px;
            }

            .debug-log-level-info { color: #00ff00; }
            .debug-log-level-warn { color: #ffff00; }
            .debug-log-level-error { color: #ff0000; }
            .debug-log-level-debug { color: #00ffff; }

            .debug-toggle-btn {
                position: fixed;
                top: 10px;
                right: 10px;
                background: #007bff;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 20px;
                cursor: pointer;
                z-index: 9999;
                font-size: 12px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }

            .debug-toggle-btn:hover {
                background: #0056b3;
            }

            @media (max-width: 768px) {
                .debug-console {
                    width: calc(100vw - 20px);
                    height: 300px;
                    top: 10px;
                    right: 10px;
                    left: 10px;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.insertAdjacentHTML('beforeend', consoleHTML);

        // Enterキーでコマンド実行
        document.getElementById('debugInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
        });
        
        // スクロール監視を追加
        const logsContainer = document.getElementById('debugLogs');
        if (logsContainer) {
            logsContainer.addEventListener('scroll', () => {
                this.checkAutoScroll();
            });
        }
    }

    addToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'debugToggleBtn';
        toggleBtn.className = 'debug-toggle-btn';
        toggleBtn.innerHTML = '🐛 Debug';
        toggleBtn.onclick = () => this.toggle();
        document.body.appendChild(toggleBtn);
    }

    interceptConsole() {
        // 元のconsoleメソッドを保存
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        // consoleメソッドをオーバーライド
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.addLog('info', args);
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.addLog('warn', args);
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.addLog('error', args);
        };

        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.addLog('info', args);
        };

        // カスタムデバッグメソッドを追加
        console.debug = (...args) => {
            this.originalConsole.log('[DEBUG]', ...args);
            this.addLog('debug', args);
        };
    }

    addLog(level, args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ');

        const logEntry = {
            timestamp,
            level,
            message
        };

        this.logs.push(logEntry);

        // ログ数制限
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const logsContainer = document.getElementById('debugLogs');
        if (!logsContainer) return;

        const logsHTML = this.logs.map(log => `
            <div class="debug-log-entry">
                <span class="debug-log-time">[${log.timestamp}]</span>
                <span class="debug-log-level-${log.level}">[${log.level.toUpperCase()}]</span>
                <span>${this.escapeHtml(log.message)}</span>
            </div>
        `).join('');

        logsContainer.innerHTML = logsHTML;
        
        // 自動スクロールが有効な場合のみ最下部へスクロール
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }
    
    checkAutoScroll() {
        const logsContainer = document.getElementById('debugLogs');
        if (!logsContainer) return;
        
        // ユーザーが手動でスクロールした場合、自動スクロールを一時的に無効化
        const isAtBottom = logsContainer.scrollHeight - logsContainer.clientHeight <= logsContainer.scrollTop + 1;
        if (!isAtBottom) {
            this.autoScroll = false;
            this.updateAutoScrollButton();
        }
    }
    
    scrollToBottom() {
        const logsContainer = document.getElementById('debugLogs');
        if (logsContainer) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    }
    
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.updateAutoScrollButton();
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }
    
    updateAutoScrollButton() {
        const btn = document.getElementById('autoScrollBtn');
        if (btn) {
            btn.textContent = `自動スクロール: ${this.autoScroll ? 'ON' : 'OFF'}`;
            btn.style.background = this.autoScroll ? '#28a745' : '#444';
        }
    }

    toggle() {
        this.isVisible = !this.isVisible;
        const console = document.getElementById('debugConsole');
        const toggleBtn = document.getElementById('debugToggleBtn');
        
        if (this.isVisible) {
            console.style.display = 'flex';
            toggleBtn.style.display = 'none';
        } else {
            console.style.display = 'none';
            toggleBtn.style.display = 'block';
        }
    }

    clear() {
        this.logs = [];
        this.updateLogDisplay();
    }

    copyAllLogs() {
        const logsText = this.logs.map(log => 
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');

        if (navigator.clipboard && window.isSecureContext) {
            // モダンブラウザでクリップボードAPIを使用
            navigator.clipboard.writeText(logsText).then(() => {
                this.addLog('info', ['📋 ログをクリップボードにコピーしました']);
            }).catch(err => {
                this.addLog('error', ['クリップボードへのコピーに失敗:', err]);
                this.fallbackCopyTextToClipboard(logsText);
            });
        } else {
            // フォールバック方法
            this.fallbackCopyTextToClipboard(logsText);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 画面に見えないように設定
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'ログをクリップボードにコピーしました' : 'コピーに失敗しました';
            this.addLog('info', ['📋', msg]);
        } catch (err) {
            this.addLog('error', ['クリップボードへのコピーに失敗:', err]);
        }

        document.body.removeChild(textArea);
    }

    downloadLogs() {
        const logsText = this.logs.map(log => 
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
        ).join('\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    executeCommand() {
        const input = document.getElementById('debugInput');
        const command = input.value.trim();
        
        if (!command) return;

        this.addLog('debug', [`> ${command}`]);

        try {
            const result = eval(command);
            this.addLog('info', [`< ${result}`]);
        } catch (error) {
            this.addLog('error', [`< Error: ${error.message}`]);
        }

        input.value = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // デバッグ用ヘルパーメソッド
    logObject(obj, label = 'Object') {
        this.addLog('debug', [`${label}:`, obj]);
    }

    logAPI(url, data = null) {
        this.addLog('debug', [`API Call: ${url}`, data ? `Data: ${JSON.stringify(data)}` : '']);
    }

    logTemplate(template) {
        this.addLog('debug', [
            `Template Debug:`,
            `ID: ${template.id}`,
            `Name: ${template.name}`,
            `Has cell_data: ${!!template.cell_data}`,
            `Has layout_config: ${!!template.layout_config}`,
            `Has cell_styles: ${!!template.cell_styles}`,
            `Has merged_cells: ${!!template.merged_cells}`
        ]);
    }

    logError(error, context = '') {
        this.addLog('error', [`${context} Error:`, error.message, error.stack]);
    }
}

// グローバルインスタンス作成
window.debugConsole = new DebugConsole();

// デバッグ用ヘルパー関数をグローバルに公開
window.debugLog = (message, data = null) => {
    console.debug(message, data);
};

window.debugAPI = (url, data = null) => {
    debugConsole.logAPI(url, data);
};

window.debugTemplate = (template) => {
    debugConsole.logTemplate(template);
};

window.debugError = (error, context = '') => {
    debugConsole.logError(error, context);
};