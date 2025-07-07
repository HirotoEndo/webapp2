// 黒板テンプレートエディタ
class BlackboardTemplateEditor {
    constructor() {
        this.rows = 8;
        this.cols = 6;
        this.selectedCells = new Set();
        this.lastSelectedCell = null;
        this.cellData = {};
        this.cellTypes = {}; // セルタイプデータ（fixed/variable）
        this.cellConfigs = {}; // セル設定データ（ドロップダウン選択肢など）
        this.cellSizes = {}; // セルサイズデータ（幅・高さ）
        this.mergedCells = new Map();
        this.history = [];
        this.historyIndex = -1;
        this.isSelecting = false;
        this.isResizing = false; // リサイズ中フラグ
        this.resizeData = null; // リサイズデータ
        
        this.init();
    }
    
    init() {
        this.createGrid();
        this.attachEventListeners();
        this.saveState();
    }
    
    // グリッドを作成
    createGrid() {
        const grid = document.getElementById('blackboardGrid');
        grid.innerHTML = '';
        
        // ヘッダー行を作成
        const headerRow = document.createElement('tr');
        
        // 左上角のセル
        const cornerCell = document.createElement('td');
        cornerCell.className = 'corner-cell';
        headerRow.appendChild(cornerCell);
        
        // 列ヘッダーを作成
        for (let col = 0; col < this.cols; col++) {
            const colHeader = document.createElement('td');
            colHeader.className = 'col-header';
            colHeader.textContent = this.numberToColumn(col + 1);
            colHeader.onclick = () => this.selectColumn(col);
            headerRow.appendChild(colHeader);
        }
        grid.appendChild(headerRow);
        
        // データ行を作成
        for (let row = 0; row < this.rows; row++) {
            const tr = document.createElement('tr');
            
            // 行ヘッダー
            const rowHeader = document.createElement('td');
            rowHeader.className = 'row-header';
            rowHeader.textContent = row + 1;
            rowHeader.onclick = () => this.selectRow(row);
            tr.appendChild(rowHeader);
            
            // データセル
            for (let col = 0; col < this.cols; col++) {
                const cell = this.createCell(row, col);
                tr.appendChild(cell);
            }
            
            grid.appendChild(tr);
        }
        
        this.updateSelectionInfo();
    }
    
    // セルを作成
    createCell(row, col) {
        const cell = document.createElement('td');
        const cellId = `${row}-${col}`;
        cell.className = 'grid-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.dataset.cellId = cellId;
        
        // セルのサイズを設定
        if (this.cellSizes[cellId]) {
            const size = this.cellSizes[cellId];
            if (size.width) cell.style.width = size.width + 'px';
            if (size.height) cell.style.height = size.height + 'px';
        }
        
        // セルの内容を設定
        if (this.cellData[cellId]) {
            const data = this.cellData[cellId];
            cell.textContent = data.text || '';
            if (data.style) {
                Object.assign(cell.style, data.style);
            }
            if (data.className) {
                cell.className += ' ' + data.className;
            }
        }
        
        // イベントリスナーを追加
        cell.addEventListener('mousedown', (e) => this.onCellMouseDown(e, row, col));
        cell.addEventListener('mouseover', (e) => this.onCellMouseOver(e, row, col));
        cell.addEventListener('mouseup', (e) => this.onCellMouseUp(e, row, col));
        cell.addEventListener('dblclick', (e) => this.onCellDoubleClick(e, row, col));
        
        return cell;
    }
    
    // セルマウスダウンイベント
    onCellMouseDown(e, row, col) {
        e.preventDefault();
        this.isSelecting = true;
        
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd クリック: 複数選択
            this.toggleCellSelection(row, col);
        } else if (e.shiftKey && this.lastSelectedCell) {
            // Shift クリック: 範囲選択
            this.selectRange(this.lastSelectedCell.row, this.lastSelectedCell.col, row, col);
        } else {
            // 通常クリック: 単一選択
            this.selectCell(row, col);
        }
        
        this.updateCellProperties();
    }
    
    // セルマウスオーバーイベント
    onCellMouseOver(e, row, col) {
        if (this.isSelecting && (e.buttons & 1)) {
            // ドラッグ選択
            if (this.lastSelectedCell) {
                this.selectRange(this.lastSelectedCell.row, this.lastSelectedCell.col, row, col);
            }
        }
    }
    
    // セルマウスアップイベント
    onCellMouseUp(e, row, col) {
        this.isSelecting = false;
    }
    
    // セルダブルクリックイベント
    onCellDoubleClick(e, row, col) {
        this.editCell(row, col);
    }
    
    // セルを選択
    selectCell(row, col) {
        this.clearSelection();
        this.selectedCells.add(`${row}-${col}`);
        this.lastSelectedCell = { row, col };
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // セル選択を切り替え
    toggleCellSelection(row, col) {
        const cellId = `${row}-${col}`;
        if (this.selectedCells.has(cellId)) {
            this.selectedCells.delete(cellId);
        } else {
            this.selectedCells.add(cellId);
            this.lastSelectedCell = { row, col };
        }
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // 範囲選択
    selectRange(startRow, startCol, endRow, endCol) {
        this.clearSelection();
        
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                this.selectedCells.add(`${row}-${col}`);
            }
        }
        
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // 行を選択
    selectRow(row) {
        this.clearSelection();
        for (let col = 0; col < this.cols; col++) {
            this.selectedCells.add(`${row}-${col}`);
        }
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // 列を選択
    selectColumn(col) {
        this.clearSelection();
        for (let row = 0; row < this.rows; row++) {
            this.selectedCells.add(`${row}-${col}`);
        }
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // 選択をクリア
    clearSelection() {
        this.selectedCells.clear();
        this.updateGridDisplay();
    }
    
    // グリッド表示を更新
    updateGridDisplay() {
        const cells = document.querySelectorAll('.grid-cell');
        
        // 既存のリサイズハンドルを削除
        document.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
        
        cells.forEach(cell => {
            const cellId = cell.dataset.cellId;
            cell.classList.remove('selected', 'multi-selected');
            
            if (this.selectedCells.has(cellId)) {
                if (this.selectedCells.size === 1) {
                    cell.classList.add('selected');
                    // 単一セル選択時のみリサイズハンドルを追加
                    this.addResizeHandles(cell);
                } else {
                    cell.classList.add('multi-selected');
                }
            }
        });
    }
    
    // リサイズハンドルを追加
    addResizeHandles(cell) {
        // 右端ハンドル
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle resize-handle-right';
        rightHandle.addEventListener('mousedown', (e) => this.startResize(e, cell, 'width'));
        cell.appendChild(rightHandle);
        
        // 下端ハンドル
        const bottomHandle = document.createElement('div');
        bottomHandle.className = 'resize-handle resize-handle-bottom';
        bottomHandle.addEventListener('mousedown', (e) => this.startResize(e, cell, 'height'));
        cell.appendChild(bottomHandle);
        
        // 右下角ハンドル
        const cornerHandle = document.createElement('div');
        cornerHandle.className = 'resize-handle resize-handle-corner';
        cornerHandle.addEventListener('mousedown', (e) => this.startResize(e, cell, 'both'));
        cell.appendChild(cornerHandle);
    }
    
    // 選択情報を更新
    updateSelectionInfo() {
        const info = document.getElementById('selection-info');
        if (this.selectedCells.size === 0) {
            info.textContent = 'なし';
        } else if (this.selectedCells.size === 1) {
            const cellId = [...this.selectedCells][0];
            const [row, col] = cellId.split('-').map(Number);
            info.textContent = `${this.numberToColumn(col + 1)}${row + 1}`;
        } else {
            info.textContent = `${this.selectedCells.size}個のセル`;
        }
    }
    
    // セルを編集
    editCell(row, col) {
        const cell = document.querySelector(`[data-cell-id="${row}-${col}"]`);
        if (!cell) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-input';
        input.value = cell.textContent || '';
        
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const value = input.value;
            this.setCellText(row, col, value);
            cell.textContent = value;
            this.saveState();
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                cell.textContent = this.getCellText(row, col) || '';
            }
        });
    }
    
    // セルプロパティを更新
    updateCellProperties() {
        if (this.selectedCells.size === 1) {
            const cellId = [...this.selectedCells][0];
            const [row, col] = cellId.split('-').map(Number);
            const cellData = this.cellData[cellId];
            const cellType = this.cellTypes[cellId] || 'fixed';
            const cellConfig = this.cellConfigs[cellId] || {};
            const cellSize = this.cellSizes[cellId] || { width: 80, height: 30 };
            
            // テキスト設定
            document.getElementById('cellText').value = cellData?.text || '';
            
            // セルタイプ設定
            document.getElementById('cellTypeFixed').checked = cellType === 'fixed';
            document.getElementById('cellTypeVariable').checked = cellType === 'variable';
            
            // セルサイズ設定
            document.getElementById('cellWidth').value = cellSize.width || 80;
            document.getElementById('cellHeight').value = cellSize.height || 30;
            
            console.log('セルサイズをUIに反映:', cellId, cellSize);
            
            // 可変セル設定
            if (cellType === 'variable') {
                document.getElementById('variableCellSettings').style.display = 'block';
                document.getElementById('dropdownOptions').value = cellConfig.options ? cellConfig.options.join('\n') : '';
                document.getElementById('allowOther').checked = cellConfig.allowOther !== false;
            } else {
                document.getElementById('variableCellSettings').style.display = 'none';
            }
        } else {
            // 複数選択または未選択の場合
            document.getElementById('cellText').value = '';
            document.getElementById('cellTypeFixed').checked = true;
            document.getElementById('cellTypeVariable').checked = false;
            document.getElementById('variableCellSettings').style.display = 'none';
            document.getElementById('cellWidth').value = 80;
            document.getElementById('cellHeight').value = 30;
        }
    }
    
    // セルテキストを設定
    setCellText(row, col, text) {
        const cellId = `${row}-${col}`;
        if (!this.cellData[cellId]) {
            this.cellData[cellId] = {};
        }
        this.cellData[cellId].text = text;
    }
    
    // セルテキストを取得
    getCellText(row, col) {
        const cellId = `${row}-${col}`;
        return this.cellData[cellId]?.text || '';
    }
    
    // セルタイプを設定
    setCellType(cellId, type) {
        this.cellTypes[cellId] = type;
        if (type === 'variable') {
            // 可変セルの場合、デフォルト設定を初期化
            if (!this.cellConfigs[cellId]) {
                this.cellConfigs[cellId] = {
                    options: [],
                    allowOther: true
                };
            }
        }
    }
    
    // セル設定を更新
    updateCellConfig(key, value) {
        if (this.selectedCells.size === 1) {
            const cellId = [...this.selectedCells][0];
            if (!this.cellConfigs[cellId]) {
                this.cellConfigs[cellId] = {};
            }
            this.cellConfigs[cellId][key] = value;
        }
    }
    
    // イベントリスナーを追加
    attachEventListeners() {
        // セルテキスト変更
        document.getElementById('cellText').addEventListener('input', (e) => {
            const text = e.target.value;
            this.selectedCells.forEach(cellId => {
                const [row, col] = cellId.split('-').map(Number);
                this.setCellText(row, col, text);
                const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                if (cell) cell.textContent = text;
            });
        });
        
        // ドロップダウン選択肢変更
        document.getElementById('dropdownOptions').addEventListener('input', (e) => {
            const options = e.target.value.split('\n').filter(option => option.trim() !== '');
            this.updateCellConfig('options', options);
        });
        
        // その他オプション変更
        document.getElementById('allowOther').addEventListener('change', (e) => {
            this.updateCellConfig('allowOther', e.target.checked);
        });
        
        // グローバルマウスイベント（リサイズ用）
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        this.undoAction();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redoAction();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;
                }
            }
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelectedCells();
            }
        });
    }
    
    // 全選択
    selectAll() {
        this.clearSelection();
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.selectedCells.add(`${row}-${col}`);
            }
        }
        this.updateGridDisplay();
        this.updateSelectionInfo();
    }
    
    // 選択されたセルを削除
    deleteSelectedCells() {
        this.selectedCells.forEach(cellId => {
            const [row, col] = cellId.split('-').map(Number);
            this.setCellText(row, col, '');
            const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
            if (cell) cell.textContent = '';
        });
        this.saveState();
    }
    
    // 列番号を文字に変換
    numberToColumn(num) {
        let result = '';
        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }
        return result;
    }
    
    // 状態を保存（Undo/Redo用）
    saveState() {
        const state = {
            cellData: JSON.parse(JSON.stringify(this.cellData)),
            cellTypes: JSON.parse(JSON.stringify(this.cellTypes)),
            cellConfigs: JSON.parse(JSON.stringify(this.cellConfigs)),
            cellSizes: JSON.parse(JSON.stringify(this.cellSizes)),
            mergedCells: new Map(this.mergedCells),
            rows: this.rows,
            cols: this.cols
        };
        
        // 現在の位置以降の履歴を削除
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        
        // 履歴の上限
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    // 元に戻す
    undoAction() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    // やり直し
    redoAction() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    // 状態を復元
    restoreState(state) {
        this.cellData = state.cellData;
        this.cellTypes = state.cellTypes || {};
        this.cellConfigs = state.cellConfigs || {};
        this.cellSizes = state.cellSizes || {};
        this.mergedCells = state.mergedCells;
        this.rows = state.rows;
        this.cols = state.cols;
        this.createGrid();
    }
    
    // グリッドサイズを変更
    resizeGrid(deltaRows, deltaCols) {
        const newRows = Math.max(1, this.rows + deltaRows);
        const newCols = Math.max(1, this.cols + deltaCols);
        
        this.rows = newRows;
        this.cols = newCols;
        this.createGrid();
        this.saveState();
    }
    
    // リサイズ開始
    startResize(e, cell, direction) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('リサイズ開始:', direction);
        
        this.isResizing = true;
        document.body.classList.add('resizing');
        
        const cellRect = cell.getBoundingClientRect();
        const cellId = cell.dataset.cellId;
        
        this.resizeData = {
            cell: cell,
            cellId: cellId,
            direction: direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: cellRect.width,
            startHeight: cellRect.height,
            originalWidth: cell.style.width || cellRect.width + 'px',
            originalHeight: cell.style.height || cellRect.height + 'px'
        };
        
        console.log('リサイズデータ:', this.resizeData);
    }
    
    // マウス移動（リサイズ中）
    onMouseMove(e) {
        if (!this.isResizing || !this.resizeData) return;
        
        e.preventDefault();
        
        const data = this.resizeData;
        const deltaX = e.clientX - data.startX;
        const deltaY = e.clientY - data.startY;
        
        let newWidth = data.startWidth;
        let newHeight = data.startHeight;
        
        if (data.direction === 'width' || data.direction === 'both') {
            newWidth = Math.max(50, data.startWidth + deltaX);
        }
        
        if (data.direction === 'height' || data.direction === 'both') {
            newHeight = Math.max(20, data.startHeight + deltaY);
        }
        
        // リアルタイムでセルサイズを更新
        if (data.direction === 'width' || data.direction === 'both') {
            data.cell.style.width = newWidth + 'px';
            data.cell.style.minWidth = newWidth + 'px';
        }
        
        if (data.direction === 'height' || data.direction === 'both') {
            data.cell.style.height = newHeight + 'px';
            data.cell.style.minHeight = newHeight + 'px';
        }
        
        // サイドバーの値も更新
        if (data.direction === 'width' || data.direction === 'both') {
            document.getElementById('cellWidth').value = Math.round(newWidth);
        }
        if (data.direction === 'height' || data.direction === 'both') {
            document.getElementById('cellHeight').value = Math.round(newHeight);
        }
    }
    
    // マウスアップ（リサイズ終了）
    onMouseUp(e) {
        if (!this.isResizing || !this.resizeData) return;
        
        console.log('リサイズ終了');
        
        const data = this.resizeData;
        const cellRect = data.cell.getBoundingClientRect();
        
        // セルサイズデータを保存
        if (!this.cellSizes[data.cellId]) {
            this.cellSizes[data.cellId] = {};
        }
        
        if (data.direction === 'width' || data.direction === 'both') {
            this.cellSizes[data.cellId].width = Math.round(cellRect.width);
        }
        
        if (data.direction === 'height' || data.direction === 'both') {
            this.cellSizes[data.cellId].height = Math.round(cellRect.height);
        }
        
        console.log('保存されたセルサイズ:', this.cellSizes[data.cellId]);
        
        // 状態を保存
        this.saveState();
        
        // リサイズ状態をリセット
        this.isResizing = false;
        this.resizeData = null;
        document.body.classList.remove('resizing');
    }
}

// グローバル変数
let editor;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    editor = new BlackboardTemplateEditor();
    
    // URLパラメータをチェックして編集モードかどうかを判定
    const urlParams = new URLSearchParams(window.location.search);
    const editTemplateId = urlParams.get('edit');
    
    if (editTemplateId) {
        // 編集モード: 既存テンプレートを読み込み
        loadExistingTemplate(parseInt(editTemplateId));
    }
});

// 既存テンプレートを読み込み
function loadExistingTemplate(templateId) {
    console.log('既存テンプレートを読み込み中...', templateId);
    
    fetch(`/api/templates/${templateId}`)
        .then(response => response.json())
        .then(template => {
            console.log('読み込んだテンプレートデータ:', template);
            
            // 基本情報を設定
            document.getElementById('templateName').value = template.name;
            document.getElementById('templateDescription').value = template.description || '';
            document.getElementById('templateWidth').value = template.default_width;
            document.getElementById('templateHeight').value = template.default_height;
            
            // レイアウト設定があれば読み込み
            if (template.layout_config) {
                try {
                    const layoutConfig = JSON.parse(template.layout_config);
                    editor.rows = layoutConfig.max_row || 8;
                    editor.cols = layoutConfig.max_col || 6;
                } catch (e) {
                    console.warn('レイアウト設定の解析に失敗:', e);
                }
            }
            
            // セルデータを読み込み
            if (template.cell_data) {
                try {
                    const cellData = JSON.parse(template.cell_data);
                    // Excel形式のセルアドレス（A1, B2など）を内部形式（0-0, 1-1など）に変換
                    for (const [excelAddress, text] of Object.entries(cellData)) {
                        const cellCoords = excelAddressToCellId(excelAddress);
                        if (cellCoords) {
                            editor.cellData[cellCoords] = { text: text };
                        }
                    }
                } catch (e) {
                    console.warn('セルデータの解析に失敗:', e);
                }
            }
            
            // セルタイプとセル設定を読み込み
            if (template.layout_config) {
                try {
                    const layoutConfig = JSON.parse(template.layout_config);
                    if (layoutConfig.cell_types) {
                        editor.cellTypes = layoutConfig.cell_types;
                    }
                    if (layoutConfig.cell_configs) {
                        editor.cellConfigs = layoutConfig.cell_configs;
                    }
                } catch (e) {
                    console.warn('セル設定の解析に失敗:', e);
                }
            }
            
            // セルサイズを読み込み
            if (template.layout_config) {
                try {
                    const layoutConfig = JSON.parse(template.layout_config);
                    if (layoutConfig.cell_sizes) {
                        editor.cellSizes = layoutConfig.cell_sizes;
                        console.log('セルサイズデータを読み込み:', editor.cellSizes);
                    } else {
                        console.log('レイアウト設定にセルサイズデータがありません');
                    }
                } catch (e) {
                    console.warn('セルサイズの解析に失敗:', e);
                }
            }
            
            // 編集用のテンプレートIDを保存
            editor.editingTemplateId = templateId;
            
            // グリッドを再作成
            editor.createGrid();
            
            // ページタイトルを変更
            document.querySelector('h1').innerHTML = '<i class="fas fa-edit"></i> テンプレート編集: ' + template.name;
            
            // 保存ボタンのテキストを変更
            const saveButton = document.querySelector('button[onclick="saveTemplate()"]');
            if (saveButton) {
                saveButton.innerHTML = '<i class="fas fa-save"></i> 更新保存';
            }
            
            console.log('テンプレート読み込み完了');
        })
        .catch(error => {
            console.error('テンプレートの読み込みに失敗しました:', error);
            alert('テンプレートの読み込みに失敗しました');
        });
}

// Excelアドレス（A1, B2など）を内部のセルID（0-0, 1-1など）に変換
function excelAddressToCellId(excelAddress) {
    const match = excelAddress.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    
    const colStr = match[1];
    const rowNum = parseInt(match[2]) - 1; // 1-indexed to 0-indexed
    
    // 列文字をインデックスに変換
    let colNum = 0;
    for (let i = 0; i < colStr.length; i++) {
        colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    colNum -= 1; // 1-indexed to 0-indexed
    
    return `${rowNum}-${colNum}`;
}

// フォーマット切り替え
function toggleFormat(type) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (!cell) return;
        
        console.log(`🎨 フォーマット適用前 [${cellId}]:`, {
            type: type,
            cssText: cell.style.cssText,
            className: cell.className
        });
        
        switch (type) {
            case 'bold':
                if (cell.classList.contains('text-bold')) {
                    cell.classList.remove('text-bold');
                    cell.style.fontWeight = '';
                } else {
                    cell.classList.add('text-bold');
                    cell.style.fontWeight = 'bold';
                }
                break;
            case 'italic':
                if (cell.classList.contains('text-italic')) {
                    cell.classList.remove('text-italic');
                    cell.style.fontStyle = '';
                } else {
                    cell.classList.add('text-italic');
                    cell.style.fontStyle = 'italic';
                }
                break;
            case 'center':
                cell.classList.remove('text-right');
                if (cell.classList.contains('text-center')) {
                    cell.classList.remove('text-center');
                    cell.style.textAlign = '';
                } else {
                    cell.classList.add('text-center');
                    cell.style.textAlign = 'center';
                }
                break;
            case 'right':
                cell.classList.remove('text-center');
                if (cell.classList.contains('text-right')) {
                    cell.classList.remove('text-right');
                    cell.style.textAlign = '';
                } else {
                    cell.classList.add('text-right');
                    cell.style.textAlign = 'right';
                }
                break;
        }
        
        console.log(`🎨 フォーマット適用後 [${cellId}]:`, {
            cssText: cell.style.cssText,
            className: cell.className
        });
    });
    
    editor.saveState();
}

// 背景色を設定
function setCellBackground(color) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            console.log(`🎨 背景色設定前 [${cellId}]:`, cell.style.cssText);
            cell.style.backgroundColor = color;
            console.log(`🎨 背景色設定後 [${cellId}]:`, cell.style.cssText);
        }
    });
    
    editor.saveState();
}

// 罫線を設定
function setBorder(type) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (!cell) return;
        
        switch (type) {
            case 'all':
                cell.style.border = '1px solid #333';
                break;
            case 'outer':
                // 外枠のみの実装は複雑なので簡略化
                cell.style.border = '2px solid #333';
                break;
            case 'none':
                cell.style.border = '1px solid #ddd';
                break;
        }
    });
    
    editor.saveState();
}

// 罫線スタイルを設定
function setBorderStyle(style) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            const currentBorder = cell.style.border || '1px solid #333';
            const borderParts = currentBorder.split(' ');
            borderParts[1] = style;
            cell.style.border = borderParts.join(' ');
        }
    });
    
    editor.saveState();
}

// セルを結合
function mergeCells() {
    if (editor.selectedCells.size < 2) {
        alert('2つ以上のセルを選択してください');
        return;
    }
    
    // 結合処理の実装（簡略化）
    const cells = Array.from(editor.selectedCells);
    const [firstRow, firstCol] = cells[0].split('-').map(Number);
    
    // 最初のセル以外を非表示にする
    cells.slice(1).forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.style.display = 'none';
        }
    });
    
    // 最初のセルのサイズを調整
    const firstCell = document.querySelector(`[data-cell-id="${cells[0]}"]`);
    if (firstCell) {
        firstCell.style.width = `${80 * Math.sqrt(editor.selectedCells.size)}px`;
    }
    
    editor.saveState();
}

// セルの結合を解除
function splitCells() {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.style.display = '';
            cell.style.width = '';
        }
    });
    
    editor.saveState();
}

// 行を挿入
function insertRow() {
    editor.resizeGrid(1, 0);
}

// 列を挿入
function insertColumn() {
    editor.resizeGrid(0, 1);
}

// 元に戻す
function undoAction() {
    editor.undoAction();
}

// やり直し
function redoAction() {
    editor.redoAction();
}

// テンプレートを保存
function saveTemplate() {
    const name = document.getElementById('templateName').value;
    const description = document.getElementById('templateDescription').value;
    const width = parseInt(document.getElementById('templateWidth').value);
    const height = parseInt(document.getElementById('templateHeight').value);
    
    if (!name.trim()) {
        alert('テンプレート名を入力してください');
        return;
    }
    
    // テンプレートデータを構築
    const templateData = {
        name: name,
        description: description,
        default_width: width,
        default_height: height,
        rows: editor.rows,
        cols: editor.cols,
        cell_data: editor.cellData,
        cell_types: editor.cellTypes,
        cell_configs: editor.cellConfigs,
        cell_sizes: editor.cellSizes,
        merged_cells: Array.from(editor.mergedCells.entries())
    };
    
    // セルのスタイル情報を収集
    const cellStyles = {};
    console.log('🎨 スタイル収集開始...');
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const cellId = cell.dataset.cellId;
        console.log(`🎨 セル [${cellId}] 検査中:`, {
            cssText: cell.style.cssText,
            className: cell.className,
            computedStyle: window.getComputedStyle(cell),
            width: cell.style.width,
            height: cell.style.height,
            textAlign: cell.style.textAlign
        });
        
        if (cell.style.cssText || cell.className !== 'grid-cell') {
            cellStyles[cellId] = {
                style: cell.style.cssText,
                className: cell.className
            };
            console.log(`🎨 セル [${cellId}] スタイル収集:`, cellStyles[cellId]);
        }
    });
    templateData.cell_styles = cellStyles;
    console.log('🎨 最終的な cellStyles:', cellStyles);
    
    // 編集モードか新規作成モードかを判定
    if (editor.editingTemplateId) {
        // 編集モード: 既存テンプレートを更新
        updateExistingTemplate(editor.editingTemplateId, templateData);
    } else {
        // 新規作成モード: 新しいテンプレートを作成
        createNewTemplate(templateData);
    }
}

// 新しいテンプレートを作成
function createNewTemplate(templateData) {
    fetch('/api/templates/create-web', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.id) {
            alert('テンプレートが保存されました');
            window.location.href = '/templates';
        } else {
            alert('保存に失敗しました');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('保存中にエラーが発生しました');
    });
}

// 既存テンプレートを更新
function updateExistingTemplate(templateId, templateData) {
    // 基本情報のみの更新データを作成
    const updateData = {
        name: templateData.name,
        description: templateData.description,
        default_width: templateData.default_width,
        default_height: templateData.default_height
    };
    
    // レイアウト設定を作成
    const layoutConfig = {
        max_row: templateData.rows,
        max_col: templateData.cols,
        cell_types: templateData.cell_types,
        cell_configs: templateData.cell_configs,
        cell_sizes: templateData.cell_sizes
    };
    
    // Excel形式のセルデータに変換
    const cellData = {};
    for (const [cellId, data] of Object.entries(templateData.cell_data)) {
        const [row, col] = cellId.split('-').map(Number);
        const excelAddress = editor.numberToColumn(col + 1) + (row + 1);
        cellData[excelAddress] = data.text || '';
    }
    
    // セルスタイル情報をExcel形式に変換
    const cellStyles = {};
    for (const [cellId, style] of Object.entries(templateData.cell_styles)) {
        const [row, col] = cellId.split('-').map(Number);
        const excelAddress = editor.numberToColumn(col + 1) + (row + 1);
        cellStyles[excelAddress] = style;
    }
    
    // 更新APIを呼び出し（Web作成APIを使用）
    const webTemplateData = {
        ...templateData,
        cell_data: Object.fromEntries(Object.entries(templateData.cell_data).map(([cellId, data]) => {
            const [row, col] = cellId.split('-').map(Number);
            return [cellId, data];
        }))
    };
    
    console.log('テンプレート更新データ:', webTemplateData);
    console.log('セルサイズデータ:', webTemplateData.cell_sizes);
    
    fetch(`/api/templates/create-web`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(webTemplateData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.id) {
            // 既存のテンプレートを削除
            return fetch(`/api/templates/${templateId}`, {
                method: 'DELETE'
            });
        } else {
            throw new Error('テンプレートの作成に失敗');
        }
    })
    .then(() => {
        alert('テンプレートが更新されました');
        window.location.href = '/templates';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('更新中にエラーが発生しました');
    });
}

// セルタイプ更新
function updateCellType() {
    const cellType = document.querySelector('input[name="cellType"]:checked').value;
    
    if (editor.selectedCells.size === 1) {
        const cellId = [...editor.selectedCells][0];
        editor.setCellType(cellId, cellType);
        
        // UI更新
        const variableSettings = document.getElementById('variableCellSettings');
        if (cellType === 'variable') {
            variableSettings.style.display = 'block';
        } else {
            variableSettings.style.display = 'none';
        }
        
        // セル表示の更新（可変セルは背景色を変更）
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            if (cellType === 'variable') {
                cell.style.backgroundColor = '#f0f8ff';
                cell.style.border = '2px dashed #007bff';
            } else {
                // 固定セルは通常の表示
                if (!cell.style.backgroundColor || cell.style.backgroundColor === 'rgb(240, 248, 255)') {
                    cell.style.backgroundColor = '';
                }
                if (cell.style.border === '2px dashed rgb(0, 123, 255)') {
                    cell.style.border = '';
                }
            }
        }
        
        editor.saveState();
    }
}

// セルサイズを更新
function updateCellSize() {
    if (!editor.selectedCells.size) return;
    
    const width = parseInt(document.getElementById('cellWidth').value);
    const height = parseInt(document.getElementById('cellHeight').value);
    
    editor.selectedCells.forEach(cellId => {
        // セルサイズデータを保存
        if (!editor.cellSizes[cellId]) {
            editor.cellSizes[cellId] = {};
        }
        editor.cellSizes[cellId].width = width;
        editor.cellSizes[cellId].height = height;
        
        // セルに適用
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.style.width = width + 'px';
            cell.style.height = height + 'px';
        }
    });
    
    editor.saveState();
}

// セルサイズを自動調整
function autoSizeCell() {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            const textLength = cell.textContent.length;
            const autoWidth = Math.max(80, Math.min(textLength * 12 + 20, 300));
            const autoHeight = 30;
            
            // セルサイズデータを保存
            if (!editor.cellSizes[cellId]) {
                editor.cellSizes[cellId] = {};
            }
            editor.cellSizes[cellId].width = autoWidth;
            editor.cellSizes[cellId].height = autoHeight;
            
            // セルに適用
            cell.style.width = autoWidth + 'px';
            cell.style.height = autoHeight + 'px';
            
            // UIを更新
            document.getElementById('cellWidth').value = autoWidth;
            document.getElementById('cellHeight').value = autoHeight;
        }
    });
    
    editor.saveState();
}

// セルサイズをリセット
function resetCellSize() {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        // セルサイズデータを削除
        delete editor.cellSizes[cellId];
        
        // セルをデフォルトサイズに戻す
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.style.width = '';
            cell.style.height = '';
        }
    });
    
    // UIを更新
    document.getElementById('cellWidth').value = 80;
    document.getElementById('cellHeight').value = 30;
    
    editor.saveState();
}

// プレビューを表示
function previewTemplate() {
    const grid = document.getElementById('blackboardGrid');
    const previewContent = document.getElementById('previewContent');
    
    // グリッドをクローンしてプレビューに表示
    const clonedGrid = grid.cloneNode(true);
    clonedGrid.style.border = '2px solid #333';
    clonedGrid.style.backgroundColor = 'white';
    
    // 編集機能を無効化
    clonedGrid.querySelectorAll('td').forEach(cell => {
        cell.onclick = null;
        cell.onmousedown = null;
        cell.onmouseover = null;
        cell.onmouseup = null;
        cell.ondblclick = null;
        cell.classList.remove('selected', 'multi-selected');
    });
    
    previewContent.innerHTML = '';
    previewContent.appendChild(clonedGrid);
    
    // モーダルを表示
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
}