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
        this.cellStyles = {}; // セルスタイルデータ（CSS、クラス名）
        this.mergedCells = new Map();
        this.history = [];
        this.historyIndex = -1;
        this.isSelecting = false;
        this.isResizing = false; // リサイズ中フラグ
        this.resizeData = null; // リサイズデータ
        this.clipboardData = null; // クリップボードデータ
        
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
        
        // アクセシビリティ属性を追加
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', '黒板テンプレートグリッド');
        grid.setAttribute('aria-rowcount', this.rows + 1);
        grid.setAttribute('aria-colcount', this.cols + 1);
        
        // ヘッダー行を作成
        const headerRow = document.createElement('tr');
        headerRow.setAttribute('role', 'row');
        headerRow.setAttribute('aria-rowindex', '1');
        
        // 左上角のセル
        const cornerCell = document.createElement('td');
        cornerCell.className = 'corner-cell';
        cornerCell.setAttribute('role', 'columnheader');
        cornerCell.setAttribute('aria-label', 'グリッド左上角');
        headerRow.appendChild(cornerCell);
        
        // 列ヘッダーを作成
        for (let col = 0; col < this.cols; col++) {
            const colHeader = document.createElement('td');
            colHeader.className = 'col-header';
            colHeader.textContent = this.numberToColumn(col + 1);
            colHeader.setAttribute('role', 'columnheader');
            colHeader.setAttribute('aria-label', `列 ${this.numberToColumn(col + 1)}`);
            colHeader.setAttribute('tabindex', '0');
            colHeader.onclick = () => this.selectColumn(col);
            
            // キーボードアクセス
            colHeader.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectColumn(col);
                }
            });
            
            headerRow.appendChild(colHeader);
        }
        grid.appendChild(headerRow);
        
        // データ行を作成
        for (let row = 0; row < this.rows; row++) {
            const tr = document.createElement('tr');
            tr.setAttribute('role', 'row');
            tr.setAttribute('aria-rowindex', row + 2);
            
            // 行ヘッダー
            const rowHeader = document.createElement('td');
            rowHeader.className = 'row-header';
            rowHeader.textContent = row + 1;
            rowHeader.setAttribute('role', 'rowheader');
            rowHeader.setAttribute('aria-label', `行 ${row + 1}`);
            rowHeader.setAttribute('tabindex', '0');
            rowHeader.onclick = () => this.selectRow(row);
            
            // キーボードアクセス
            rowHeader.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectRow(row);
                }
            });
            
            tr.appendChild(rowHeader);
            
            // データセル
            for (let col = 0; col < this.cols; col++) {
                const cell = this.createCell(row, col);
                tr.appendChild(cell);
            }
            
            grid.appendChild(tr);
        }
        
        this.updateSelectionInfo();
        
        // 結合セルを復元
        this.restoreMergedCells();
    }
    
    // セルを作成
    createCell(row, col) {
        const cell = document.createElement('td');
        const cellId = `${row}-${col}`;
        cell.className = 'grid-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.dataset.cellId = cellId;
        
        // アクセシビリティ属性を追加
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', '-1');
        cell.setAttribute('aria-label', `セル ${this.numberToColumn(col + 1)}${row + 1}`);
        
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
        
        // セルスタイルを適用
        if (this.cellStyles[cellId]) {
            const styleData = this.cellStyles[cellId];
            if (styleData.style) {
                cell.style.cssText = styleData.style;
            }
            if (styleData.className) {
                cell.className = styleData.className;
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
            // 入力フィールドにフォーカスがある場合はショートカットを無効化
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redoAction();
                        } else {
                            this.undoAction();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redoAction();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;
                    case 's':
                        e.preventDefault();
                        saveTemplate();
                        break;
                    case 'b':
                        e.preventDefault();
                        toggleFormat('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        toggleFormat('italic');
                        break;
                    case 'c':
                        e.preventDefault();
                        this.copySelectedCells();
                        break;
                    case 'v':
                        e.preventDefault();
                        this.pasteSelectedCells();
                        break;
                    case 'x':
                        e.preventDefault();
                        this.cutSelectedCells();
                        break;
                }
            }
            
            // 通常のキー操作
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    this.deleteSelectedCells();
                    break;
                case 'F2':
                    e.preventDefault();
                    this.editSelectedCell();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.clearSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.editSelectedCell();
                    break;
                case 'ArrowUp':
                case 'ArrowDown':
                case 'ArrowLeft':
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateWithArrows(e.key, e.shiftKey);
                    break;
                case 'Tab':
                    e.preventDefault();
                    this.navigateWithTab(e.shiftKey);
                    break;
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
    
    // 選択中のセルを編集
    editSelectedCell() {
        if (this.selectedCells.size === 1) {
            const cellId = [...this.selectedCells][0];
            const [row, col] = cellId.split('-').map(Number);
            this.editCell(row, col);
        }
    }
    
    // 矢印キーでナビゲーション
    navigateWithArrows(key, shiftKey) {
        if (!this.lastSelectedCell) return;
        
        let newRow = this.lastSelectedCell.row;
        let newCol = this.lastSelectedCell.col;
        
        switch (key) {
            case 'ArrowUp':
                newRow = Math.max(0, newRow - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(this.rows - 1, newRow + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, newCol - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(this.cols - 1, newCol + 1);
                break;
        }
        
        if (shiftKey) {
            // Shift+矢印キーで範囲選択
            this.selectRange(this.lastSelectedCell.row, this.lastSelectedCell.col, newRow, newCol);
        } else {
            // 通常の移動
            this.selectCell(newRow, newCol);
        }
        
        this.updateCellProperties();
    }
    
    // Tabキーでナビゲーション
    navigateWithTab(shiftKey) {
        if (!this.lastSelectedCell) {
            this.selectCell(0, 0);
            return;
        }
        
        let newRow = this.lastSelectedCell.row;
        let newCol = this.lastSelectedCell.col;
        
        if (shiftKey) {
            // Shift+Tab で前のセルへ
            newCol--;
            if (newCol < 0) {
                newCol = this.cols - 1;
                newRow--;
                if (newRow < 0) {
                    newRow = this.rows - 1;
                }
            }
        } else {
            // Tab で次のセルへ
            newCol++;
            if (newCol >= this.cols) {
                newCol = 0;
                newRow++;
                if (newRow >= this.rows) {
                    newRow = 0;
                }
            }
        }
        
        this.selectCell(newRow, newCol);
        this.updateCellProperties();
    }
    
    // セルをコピー
    copySelectedCells() {
        if (!this.selectedCells.size) return;
        
        this.clipboardData = {
            cells: [],
            operation: 'copy'
        };
        
        this.selectedCells.forEach(cellId => {
            const cellData = this.cellData[cellId] || {};
            const cellType = this.cellTypes[cellId] || 'fixed';
            const cellConfig = this.cellConfigs[cellId] || {};
            const cellSize = this.cellSizes[cellId] || {};
            const cellStyle = this.cellStyles[cellId] || {};
            
            this.clipboardData.cells.push({
                cellId,
                data: JSON.parse(JSON.stringify(cellData)),
                type: cellType,
                config: JSON.parse(JSON.stringify(cellConfig)),
                size: JSON.parse(JSON.stringify(cellSize)),
                style: JSON.parse(JSON.stringify(cellStyle))
            });
        });
        
        showSuccess(`${this.selectedCells.size}個のセルをコピーしました`);
    }
    
    // セルをカット
    cutSelectedCells() {
        this.copySelectedCells();
        if (this.clipboardData) {
            this.clipboardData.operation = 'cut';
            this.deleteSelectedCells();
        }
    }
    
    // セルをペースト
    pasteSelectedCells() {
        if (!this.clipboardData || !this.lastSelectedCell) {
            showWarning('ペースト失敗', 'コピーされたデータがありません');
            return;
        }
        
        const startRow = this.lastSelectedCell.row;
        const startCol = this.lastSelectedCell.col;
        
        this.clipboardData.cells.forEach((cellInfo, index) => {
            const [originalRow, originalCol] = cellInfo.cellId.split('-').map(Number);
            const newRow = startRow + (originalRow - this.clipboardData.cells[0].cellId.split('-')[0]);
            const newCol = startCol + (originalCol - this.clipboardData.cells[0].cellId.split('-')[1]);
            
            if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
                const newCellId = `${newRow}-${newCol}`;
                
                this.cellData[newCellId] = cellInfo.data;
                this.cellTypes[newCellId] = cellInfo.type;
                this.cellConfigs[newCellId] = cellInfo.config;
                this.cellSizes[newCellId] = cellInfo.size;
                this.cellStyles[newCellId] = cellInfo.style;
            }
        });
        
        // カット操作の場合はクリップボードをクリア
        if (this.clipboardData.operation === 'cut') {
            this.clipboardData = null;
        }
        
        this.createGrid();
        this.saveState();
        showSuccess('セルをペーストしました');
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
    
    // 結合セルを復元
    restoreMergedCells() {
        console.debug('=== 結合セル復元処理開始 ===');
        console.debug('RESTORE_DEBUG: 復元対象の結合セル数:', this.mergedCells.size);
        console.debug('RESTORE_DEBUG: 復元対象の結合データ:', Array.from(this.mergedCells.entries()));
        
        this.mergedCells.forEach((mergeInfo, mergeKey) => {
            console.debug('RESTORE_DEBUG: 結合復元中:', mergeKey, mergeInfo);
            
            try {
                const { startCell, endCell, rowSpan, colSpan } = mergeInfo;
                const [startRow, startCol] = startCell.split('-').map(Number);
                const [endRow, endCol] = endCell.split('-').map(Number);
                
                console.debug('RESTORE_DEBUG: 結合範囲:', {
                    startRow, startCol, endRow, endCol, rowSpan, colSpan
                });
                
                // メインセル（左上）を取得
                const mainCell = document.querySelector(`[data-cell-id="${startCell}"]`);
                
                if (mainCell) {
                    // HTMLテーブルのcolspanとrowspanを設定
                    mainCell.setAttribute('colspan', colSpan);
                    mainCell.setAttribute('rowspan', rowSpan);
                    mainCell.style.backgroundColor = '#e3f2fd'; // 結合セルの視覚的マーカー
                    
                    console.debug('RESTORE_DEBUG: メインセル設定完了:', {
                        cellId: startCell,
                        colspan: colSpan,
                        rowspan: rowSpan
                    });
                    
                    // 結合に含まれる他のセルを非表示にする
                    let hiddenCount = 0;
                    for (let row = startRow; row <= endRow; row++) {
                        for (let col = startCol; col <= endCol; col++) {
                            const cellId = `${row}-${col}`;
                            if (cellId !== startCell) {
                                const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                                if (cell) {
                                    cell.style.display = 'none';
                                    hiddenCount++;
                                }
                            }
                        }
                    }
                    
                    console.debug('RESTORE_DEBUG: 非表示にしたセル数:', hiddenCount);
                } else {
                    console.error('RESTORE_DEBUG: メインセルが見つかりません:', startCell);
                }
            } catch (error) {
                console.error('RESTORE_DEBUG: 結合復元エラー:', error, mergeKey, mergeInfo);
            }
        });
        
        console.debug('=== 結合セル復元処理終了 ===');
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
    
    // デバッグ情報を表示（5秒後）
    setTimeout(() => {
        console.log('🧪 セル結合デバッグ機能が有効です');
        console.log('💡 debugHelp() と入力してデバッグ機能の使用方法を確認できます');
        console.log('🐛 画面右上の「🐛 Debug」ボタンでデバッグコンソールを開けます');
    }, 5000);
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
            
            // セルスタイルを読み込み
            if (template.cell_styles) {
                try {
                    const cellStyles = JSON.parse(template.cell_styles);
                    // Excel形式のセルアドレス（A1, B2など）を内部形式（0-0, 1-1など）に変換
                    editor.cellStyles = {};
                    for (const [excelAddress, styleData] of Object.entries(cellStyles)) {
                        const cellCoords = excelAddressToCellId(excelAddress);
                        if (cellCoords) {
                            editor.cellStyles[cellCoords] = styleData;
                        }
                    }
                    console.log('セルスタイルデータを読み込み:', editor.cellStyles);
                } catch (e) {
                    console.warn('セルスタイルの解析に失敗:', e);
                }
            }
            
            // 結合セル情報を読み込み
            console.debug('=== 読み込み時の結合データデバッグ ===');
            console.debug('LOAD_DEBUG: template.merged_cells:', template.merged_cells);
            
            if (template.merged_cells) {
                try {
                    const mergedCellsData = JSON.parse(template.merged_cells);
                    console.debug('LOAD_DEBUG: パースされた結合データ:', mergedCellsData);
                    
                    editor.mergedCells = new Map(); // リセット
                    
                    // 配列かオブジェクトかを判定
                    if (Array.isArray(mergedCellsData)) {
                        // 配列形式の場合
                        mergedCellsData.forEach(([key, value]) => {
                            editor.mergedCells.set(key, value);
                            console.debug('LOAD_DEBUG: 結合情報を復元:', key, value);
                        });
                    } else if (typeof mergedCellsData === 'object') {
                        // オブジェクト形式の場合
                        Object.entries(mergedCellsData).forEach(([key, value]) => {
                            editor.mergedCells.set(key, value);
                            console.debug('LOAD_DEBUG: 結合情報を復元:', key, value);
                        });
                    }
                    
                    console.debug('LOAD_DEBUG: 復元された結合セル数:', editor.mergedCells.size);
                    console.debug('LOAD_DEBUG: 復元された結合データ:', Array.from(editor.mergedCells.entries()));
                } catch (e) {
                    console.error('LOAD_DEBUG: 結合セルの解析に失敗:', e);
                }
            } else {
                console.debug('LOAD_DEBUG: 結合セルデータがありません');
                editor.mergedCells = new Map();
            }
            
            console.debug('=== 読み込み時の結合データデバッグ終了 ===');
            
            // 編集用のテンプレートIDを保存
            editor.editingTemplateId = templateId;
            
            // グリッドを再作成
            console.debug('LOAD_DEBUG: グリッド再作成前の結合データ:', Array.from(editor.mergedCells.entries()));
            editor.createGrid();
            console.debug('LOAD_DEBUG: グリッド再作成後の結合データ:', Array.from(editor.mergedCells.entries()));
            
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
    console.log('🔧 MERGE_DEBUG: セル結合ボタンが押されました');
    console.log('🔧 MERGE_DEBUG: 現在選択されているセル:', Array.from(editor.selectedCells));
    console.log('🔧 MERGE_DEBUG: 選択セル数:', editor.selectedCells.size);
    
    if (editor.selectedCells.size < 2) {
        console.log('🔧 MERGE_DEBUG: 選択セルが不足しています（最低2個必要）');
        alert('2つ以上のセルを選択してください');
        return;
    }
    
    // 結合処理の実装
    const cells = Array.from(editor.selectedCells);
    console.log('🔧 MERGE_DEBUG: 結合対象セル:', cells);
    
    const positions = cells.map(cellId => {
        const [row, col] = cellId.split('-').map(Number);
        return { row, col, cellId };
    });
    console.log('🔧 MERGE_DEBUG: セル位置情報:', positions);
    
    // 結合範囲を計算
    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));
    
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;
    
    console.log('🔧 MERGE_DEBUG: 結合範囲:', {
        minRow, maxRow, minCol, maxCol,
        rowSpan, colSpan
    });
    
    // 結合情報を保存
    const mergeKey = `${minRow}-${minCol}_${maxRow}-${maxCol}`;
    editor.mergedCells.set(mergeKey, {
        startCell: `${minRow}-${minCol}`,
        endCell: `${maxRow}-${maxCol}`,
        rowSpan,
        colSpan
    });
    console.log('🔧 MERGE_DEBUG: 結合情報保存:', mergeKey, editor.mergedCells.get(mergeKey));
    
    // 結合範囲のメインセル（左上）を取得
    const mainCell = document.querySelector(`[data-cell-id="${minRow}-${minCol}"]`);
    
    if (mainCell) {
        // HTMLテーブルのcolspanとrowspanを設定
        mainCell.setAttribute('colspan', colSpan);
        mainCell.setAttribute('rowspan', rowSpan);
        
        console.log('🔧 MERGE_DEBUG: メインセル設定:', {
            cellId: `${minRow}-${minCol}`,
            colspan: colSpan,
            rowspan: rowSpan
        });
        
        // 結合に含まれる他のセルを非表示にする
        cells.forEach(cellId => {
            if (cellId !== `${minRow}-${minCol}`) {
                const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                if (cell) {
                    cell.style.display = 'none';
                    console.log('🔧 MERGE_DEBUG: セル非表示:', cellId);
                }
            }
        });
    }
    
    console.log('🔧 MERGE_DEBUG: 全結合情報:', Array.from(editor.mergedCells.entries()));
    
    editor.saveState();
    console.log('🔧 MERGE_DEBUG: セル結合処理完了');
}

// セルの結合を解除
function splitCells() {
    console.log('🔧 SPLIT_DEBUG: セル結合解除ボタンが押されました');
    console.log('🔧 SPLIT_DEBUG: 現在選択されているセル:', Array.from(editor.selectedCells));
    
    if (!editor.selectedCells.size) {
        console.log('🔧 SPLIT_DEBUG: 選択セルがありません');
        return;
    }
    
    // 選択されたセルに関連する結合情報を探す
    const selectedCells = Array.from(editor.selectedCells);
    const mergeKeysToRemove = [];
    
    editor.mergedCells.forEach((mergeInfo, mergeKey) => {
        const [startRow, startCol] = mergeInfo.startCell.split('-').map(Number);
        const [endRow, endCol] = mergeInfo.endCell.split('-').map(Number);
        
        // 選択されたセルが結合範囲内にあるかチェック
        const isInMergeRange = selectedCells.some(cellId => {
            const [row, col] = cellId.split('-').map(Number);
            return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
        });
        
        if (isInMergeRange) {
            console.log('🔧 SPLIT_DEBUG: 結合解除対象:', mergeKey, mergeInfo);
            mergeKeysToRemove.push(mergeKey);
            
            // メインセルのcolspan/rowspanを削除
            const mainCell = document.querySelector(`[data-cell-id="${mergeInfo.startCell}"]`);
            if (mainCell) {
                mainCell.removeAttribute('colspan');
                mainCell.removeAttribute('rowspan');
                console.log('🔧 SPLIT_DEBUG: メインセル属性削除:', mergeInfo.startCell);
            }
            
            // 結合範囲内の全セルを表示
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const cellId = `${row}-${col}`;
                    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                    if (cell) {
                        cell.style.display = '';
                        console.log('🔧 SPLIT_DEBUG: セル表示復元:', cellId);
                    }
                }
            }
        }
    });
    
    // 結合情報を削除
    mergeKeysToRemove.forEach(key => {
        editor.mergedCells.delete(key);
        console.log('🔧 SPLIT_DEBUG: 結合情報削除:', key);
    });
    
    console.log('🔧 SPLIT_DEBUG: 残存結合情報:', Array.from(editor.mergedCells.entries()));
    
    editor.saveState();
    console.log('🔧 SPLIT_DEBUG: セル結合解除処理完了');
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

// テンプレートを保存（パフォーマンス測定付き）
function saveTemplate() {
    performance.mark('saveTemplate-start');
    
    const name = document.getElementById('templateName').value;
    const description = document.getElementById('templateDescription').value;
    const width = parseInt(document.getElementById('templateWidth').value);
    const height = parseInt(document.getElementById('templateHeight').value);
    
    // 基本バリデーション
    if (!name.trim()) {
        showError('入力エラー', 'テンプレート名を入力してください');
        document.getElementById('templateName').focus();
        return;
    }
    
    if (isNaN(width) || width < 100 || width > 2000) {
        showError('入力エラー', '幅は100px〜2000pxの範囲で入力してください');
        document.getElementById('templateWidth').focus();
        return;
    }
    
    if (isNaN(height) || height < 100 || height > 1500) {
        showError('入力エラー', '高さは100px〜1500pxの範囲で入力してください');
        document.getElementById('templateHeight').focus();
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
    
    // 結合セルの保存デバッグ
    console.debug('=== 保存時の結合データデバッグ ===');
    console.debug('SAVE_DEBUG: 結合セル数:', editor.mergedCells.size);
    console.debug('SAVE_DEBUG: 結合データ:', Array.from(editor.mergedCells.entries()));
    console.debug('SAVE_DEBUG: templateData.merged_cells:', templateData.merged_cells);
    console.debug('SAVE_DEBUG: JSON化された結合データ:', JSON.stringify(templateData.merged_cells));
    
    // サーバーに送信される完全なテンプレートデータを出力
    console.debug('SAVE_DEBUG: 完全なテンプレートデータ:', {
        name: templateData.name,
        rows: templateData.rows,
        cols: templateData.cols,
        mergedCellsCount: templateData.merged_cells ? templateData.merged_cells.length : 0,
        mergedCellsData: templateData.merged_cells
    });
    console.debug('=== 保存時の結合データデバッグ終了 ===');
    
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
        console.debug('SAVE_DEBUG: サーバーレスポンス:', result);
        if (result.id) {
            console.log('✅ テンプレートが保存されました ID:', result.id);
            
            // デバッグモードかどうかを確認
            const isDebugMode = window.location.search.includes('debug=true') || 
                               window.debugConsole?.isVisible ||
                               confirm('テンプレートが保存されました。\n\nデバッグを続行しますか？\n「OK」= この画面に留まる\n「キャンセル」= テンプレート一覧に戻る');
            
            if (isDebugMode) {
                // デバッグモード：この画面に留まる
                console.log('🐛 デバッグモード: テンプレート一覧に遷移せずこの画面に留まります');
                editor.editingTemplateId = result.id; // 編集モードに切り替え
                
                // 保存ボタンのテキストを更新
                const saveButton = document.getElementById('saveButton');
                if (saveButton) {
                    saveButton.innerHTML = '<i class="fas fa-save"></i> 更新保存';
                }
                
                showSuccess('保存完了', 'テンプレートが保存されました（デバッグモード）');
            } else {
                // 通常モード：テンプレート一覧に遷移
                window.location.href = '/templates';
            }
        } else {
            console.error('SAVE_DEBUG: 保存失敗 - レスポンスにIDがありません:', result);
            showError('保存エラー', '保存に失敗しました');
        }
    })
    .catch(error => {
        console.error('SAVE_DEBUG: 保存エラー:', error);
        showError('保存エラー', '保存中にエラーが発生しました: ' + error.message);
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
        console.log('✅ テンプレートが更新されました');
        
        // デバッグモードかどうかを確認
        const isDebugMode = window.location.search.includes('debug=true') || 
                           window.debugConsole?.isVisible ||
                           confirm('テンプレートが更新されました。\n\nデバッグを続行しますか？\n「OK」= この画面に留まる\n「キャンセル」= テンプレート一覧に戻る');
        
        if (isDebugMode) {
            console.log('🐛 デバッグモード: テンプレート一覧に遷移せずこの画面に留まります');
            showSuccess('更新完了', 'テンプレートが更新されました（デバッグモード）');
        } else {
            window.location.href = '/templates';
        }
    })
    .catch(error => {
        console.error('UPDATE_DEBUG: 更新エラー:', error);
        showError('更新エラー', '更新中にエラーが発生しました: ' + error.message);
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

// バリデーション関数
function validateTemplateData(templateData) {
    if (!templateData.name || templateData.name.trim().length === 0) {
        return { isValid: false, message: 'テンプレート名は必須です' };
    }
    
    if (templateData.name.length > 255) {
        return { isValid: false, message: 'テンプレート名は255文字以内で入力してください' };
    }
    
    if (templateData.description && templateData.description.length > 1000) {
        return { isValid: false, message: '説明は1000文字以内で入力してください' };
    }
    
    if (templateData.default_width < 100 || templateData.default_width > 2000) {
        return { isValid: false, message: '幅は100px〜2000pxの範囲で入力してください' };
    }
    
    if (templateData.default_height < 100 || templateData.default_height > 1500) {
        return { isValid: false, message: '高さは100px〜1500pxの範囲で入力してください' };
    }
    
    if (templateData.rows < 1 || templateData.rows > 50) {
        return { isValid: false, message: '行数は1〜50の範囲で設定してください' };
    }
    
    if (templateData.cols < 1 || templateData.cols > 26) {
        return { isValid: false, message: '列数は1〜26の範囲で設定してください' };
    }
    
    return { isValid: true, message: '' };
}

// 通知関数
function showLoading(message) {
    hideAllNotifications();
    
    const loading = document.createElement('div');
    loading.id = 'loading-notification';
    loading.className = 'notification loading';
    loading.innerHTML = `
        <div class="notification-content">
            <div class="spinner"></div>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loading-notification');
    if (loading) {
        loading.remove();
    }
}

function showSuccess(message) {
    showNotification('success', message, 3000);
}

function showError(title, message) {
    showNotification('error', `${title}: ${message}`, 5000);
}

function showWarning(title, message) {
    showNotification('warning', `${title}: ${message}`, 4000);
}

function showNotification(type, message, duration = 3000) {
    hideAllNotifications();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getIconForType(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // アニメーション
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    // 自動削除
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

function getIconForType(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function hideAllNotifications() {
    document.querySelectorAll('.notification').forEach(notification => {
        notification.remove();
    });
}

// キーボードショートカットを表示
function showKeyboardShortcuts() {
    const modal = new bootstrap.Modal(document.getElementById('shortcutsModal'));
    modal.show();
}

// デバッグ用テスト関数（グローバル）
window.debugMergeTest = function() {
    console.debug('=== 結合セル保存・読み込みテスト開始 ===');
    
    if (!editor) {
        console.error('エディタが初期化されていません');
        return;
    }
    
    // 現在の結合セルデータを出力
    console.debug('DEBUG_TEST: 現在の結合セル数:', editor.mergedCells.size);
    console.debug('DEBUG_TEST: 現在の結合データ:', Array.from(editor.mergedCells.entries()));
    
    // テストデータを作成
    const testMergeData = new Map();
    testMergeData.set('0-0_1-1', {
        startCell: '0-0',
        endCell: '1-1',
        rowSpan: 2,
        colSpan: 2
    });
    testMergeData.set('2-2_3-3', {
        startCell: '2-2',
        endCell: '3-3',
        rowSpan: 2,
        colSpan: 2
    });
    
    // テストデータをエディタに設定
    editor.mergedCells = testMergeData;
    console.debug('DEBUG_TEST: テスト用結合データ設定:', Array.from(editor.mergedCells.entries()));
    
    // 保存処理をシミュレート
    const templateData = {
        name: 'デバッグテスト',
        merged_cells: Array.from(editor.mergedCells.entries())
    };
    
    console.debug('DEBUG_TEST: 保存用データ:', templateData);
    console.debug('DEBUG_TEST: JSON化された結合データ:', JSON.stringify(templateData.merged_cells));
    
    // 読み込み処理をシミュレート
    const mergedCellsData = JSON.parse(JSON.stringify(templateData.merged_cells));
    console.debug('DEBUG_TEST: 読み込みデータ:', mergedCellsData);
    
    // 復元処理をシミュレート
    const restoredMap = new Map();
    if (Array.isArray(mergedCellsData)) {
        mergedCellsData.forEach(([key, value]) => {
            restoredMap.set(key, value);
            console.debug('DEBUG_TEST: 復元中:', key, value);
        });
    }
    
    console.debug('DEBUG_TEST: 復元されたMap:', Array.from(restoredMap.entries()));
    console.debug('DEBUG_TEST: 元データと復元データの比較:', {
        original: Array.from(editor.mergedCells.entries()),
        restored: Array.from(restoredMap.entries()),
        equal: JSON.stringify(Array.from(editor.mergedCells.entries())) === JSON.stringify(Array.from(restoredMap.entries()))
    });
    
    // 実際の復元処理をテスト
    editor.mergedCells = restoredMap;
    console.debug('DEBUG_TEST: 復元後のエディタ結合データ:', Array.from(editor.mergedCells.entries()));
    
    // 視覚的復元をテスト
    editor.restoreMergedCells();
    
    console.debug('=== 結合セル保存・読み込みテスト終了 ===');
    console.log('🧪 テストが完了しました。デバッグコンソールで結果を確認してください。');
    
    // デバッグコンソールを自動的に開く
    if (window.debugConsole && !window.debugConsole.isVisible) {
        window.debugConsole.toggle();
    }
};

// 実際のAPI保存・読み込みテスト
window.debugApiMergeTest = function() {
    console.debug('=== API経由結合セル保存・読み込みテスト開始 ===');
    
    if (!editor) {
        console.error('エディタが初期化されていません');
        return;
    }
    
    // テストのために実際にセルを結合
    console.debug('API_TEST: 2×2の結合セルを作成します...');
    editor.selectedCells = new Set(['0-0', '0-1', '1-0', '1-1']);
    mergeCells();
    
    console.debug('API_TEST: 結合後のデータ:', Array.from(editor.mergedCells.entries()));
    
    // 一時的にテンプレート名を設定
    document.getElementById('templateName').value = 'APIテスト_' + Date.now();
    
    console.debug('API_TEST: 保存を開始します...');
    
    // 保存実行
    saveTemplate();
    
    console.debug('=== API経由結合セル保存・読み込みテスト終了 ===');
    console.log('🧪 APIテストが開始されました。ネットワークタブとデバッグコンソールで結果を確認してください。');
};

// デバッグコンソールの状態確認
window.checkDebugConsole = function() {
    console.debug('=== デバッグコンソール状態確認 ===');
    console.debug('DEBUG_CHECK: debugConsole存在:', !!window.debugConsole);
    console.debug('DEBUG_CHECK: debugConsole表示状態:', window.debugConsole ? window.debugConsole.isVisible : 'N/A');
    console.debug('DEBUG_CHECK: console.debug動作確認:', '正常に動作しています');
    console.log('DEBUG_CHECK: console.log動作確認:', '正常に動作しています');
    console.warn('DEBUG_CHECK: console.warn動作確認:', '正常に動作しています');
    console.error('DEBUG_CHECK: console.error動作確認:', '正常に動作しています');
    
    // デバッグコンソールを開く
    if (window.debugConsole && !window.debugConsole.isVisible) {
        window.debugConsole.toggle();
        console.debug('DEBUG_CHECK: デバッグコンソールを開きました');
    }
    
    console.debug('=== デバッグコンソール状態確認終了 ===');
};

// デバッグヘルプ表示
window.debugHelp = function() {
    console.log('🧪 === デバッグ支援機能 ===');
    console.log('');
    console.log('利用可能なデバッグ関数:');
    console.log('• checkDebugConsole() - デバッグコンソールの状態確認');
    console.log('• debugMergeTest() - 結合セルの保存・読み込み機能テスト');
    console.log('• debugApiMergeTest() - API経由での実際の保存・読み込みテスト');
    console.log('• debugHelp() - このヘルプ表示');
    console.log('');
    console.log('デバッグコンソールアクセス:');
    console.log('• 画面右上の「🐛 Debug」ボタン、または');
    console.log('• debugConsole.toggle()');
    console.log('');
    console.log('問題の再現手順:');
    console.log('1. checkDebugConsole() でデバッグ環境確認');
    console.log('2. 手動でセル結合を作成');
    console.log('3. 保存ボタンで保存');
    console.log('4. ページを再読み込み');
    console.log('5. デバッグコンソールで結合データの有無を確認');
    console.log('');
    console.log('自動テスト:');
    console.log('• debugMergeTest() - ローカルテスト');
    console.log('• debugApiMergeTest() - APIテスト');
    console.log('');
    console.log('🔍 問題特定のために、保存・読み込み時のデバッグ出力を確認してください。');
};

// 完全なテスト（結合→保存→再読み込み）
window.fullMergeTest = function() {
    console.debug('=== 完全な結合セルテスト開始 ===');
    
    if (!editor) {
        console.error('エディタが初期化されていません');
        return;
    }
    
    // ステップ1: セルを結合
    console.debug('FULL_TEST: ステップ1 - セル結合');
    editor.selectedCells = new Set(['0-0', '0-1']);
    mergeCells();
    
    console.debug('FULL_TEST: 結合後のデータ確認:', Array.from(editor.mergedCells.entries()));
    
    // ステップ2: 保存準備
    console.debug('FULL_TEST: ステップ2 - 保存準備');
    document.getElementById('templateName').value = 'フルテスト_' + Date.now();
    
    // ステップ3: 保存
    console.debug('FULL_TEST: ステップ3 - 保存実行');
    saveTemplate();
    
    console.debug('=== 完全な結合セルテスト完了 ===');
    console.log('🧪 保存完了後、ページを再読み込みして結合セルが復元されるかを確認してください');
};