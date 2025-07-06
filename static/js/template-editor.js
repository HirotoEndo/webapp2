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
        this.mergedCells = new Map();
        this.history = [];
        this.historyIndex = -1;
        this.isSelecting = false;
        
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
        cells.forEach(cell => {
            const cellId = cell.dataset.cellId;
            cell.classList.remove('selected', 'multi-selected');
            
            if (this.selectedCells.has(cellId)) {
                if (this.selectedCells.size === 1) {
                    cell.classList.add('selected');
                } else {
                    cell.classList.add('multi-selected');
                }
            }
        });
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
            
            // テキスト設定
            document.getElementById('cellText').value = cellData?.text || '';
            
            // セルタイプ設定
            document.getElementById('cellTypeFixed').checked = cellType === 'fixed';
            document.getElementById('cellTypeVariable').checked = cellType === 'variable';
            
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
}

// グローバル変数
let editor;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    editor = new BlackboardTemplateEditor();
});

// フォーマット切り替え
function toggleFormat(type) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (!cell) return;
        
        switch (type) {
            case 'bold':
                cell.classList.toggle('text-bold');
                break;
            case 'italic':
                cell.classList.toggle('text-italic');
                break;
            case 'center':
                cell.classList.remove('text-right');
                cell.classList.toggle('text-center');
                break;
            case 'right':
                cell.classList.remove('text-center');
                cell.classList.toggle('text-right');
                break;
        }
    });
    
    editor.saveState();
}

// 背景色を設定
function setCellBackground(color) {
    if (!editor.selectedCells.size) return;
    
    editor.selectedCells.forEach(cellId => {
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.style.backgroundColor = color;
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
        merged_cells: Array.from(editor.mergedCells.entries())
    };
    
    // セルのスタイル情報を収集
    const cellStyles = {};
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const cellId = cell.dataset.cellId;
        if (cell.style.cssText || cell.className !== 'grid-cell') {
            cellStyles[cellId] = {
                style: cell.style.cssText,
                className: cell.className
            };
        }
    });
    templateData.cell_styles = cellStyles;
    
    // APIに送信
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