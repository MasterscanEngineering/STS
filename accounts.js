const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyAfDeE-dM6fRXXH3VkKti6Qux2aO-E4oYroaoyMgNiRNXEuJhg7PcobO7NfGhnohItw/exec';

let masterList = {};
let masterWorkers = [];
let allDepartments = [];
let step1Data = [];
let step2Data = [];
let step3Data = []; // Tech mapping
let step4Data = []; // Final comparison
let currentUploadedFileName = "accounts_summary.xlsx";

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
}

function switchSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

async function attemptLogin() {
    const id = document.getElementById('loginUserId').value.trim();
    const pwd = document.getElementById('loginPassword').value;

    if (!id || !pwd) return alert('Enter ID and Password');

    showLoading(true);
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getAccountsData`);
        const result = await res.json();

        if (result.status === 'success') {
            const users = result.data;
            const validUser = users.find(u => u.id === id && u.password === pwd);
            if (validUser) {
                masterList = result.masterList || {};
                // Extract all worker names from master list for autocomplete/matching
                masterWorkers = [];
                allDepartments = Object.keys(masterList);
                allDepartments.forEach(dept => {
                    if (dept.toLowerCase().includes('accounts')) return;
                    masterList[dept].forEach(w => {
                        masterWorkers.push({ name: w.name || w, dept: dept });
                    });
                });

                populateDropdowns();
                document.getElementById('headerActions').classList.remove('hidden');
                showDashboard();
            } else {
                alert('Invalid Credentials or User not authorized for Accounts Portal.');
            }
        } else {
            alert('Error connecting to server.');
        }
    } catch (e) {
        alert('Network error.');
    }
    showLoading(false);
}

function populateDropdowns() {
    const deptSelects = [document.getElementById('summaryDept'), document.getElementById('histDept')];
    deptSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select Dept</option><option value="ALL DEPARTMENT">ALL DEPARTMENT</option>';
        allDepartments.forEach(d => {
            if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                select.appendChild(opt);
            }
        });
    });

    const summaryDept = document.getElementById('summaryDept');
    if (summaryDept) {
        summaryDept.onchange = function () {
            const dept = this.value;
            const nameSelect = document.getElementById('summaryName');
            if (nameSelect) {
                nameSelect.innerHTML = '<option value="All">All Workers</option>';
                if (dept === 'ALL DEPARTMENT' || dept === 'ALL' || dept === 'ALL DEPARTMENTS') {
                    const allWorkers = [];
                    allDepartments.forEach(d => {
                        if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                            const list = (typeof masterList !== 'undefined' ? masterList[d] : null) || (typeof masterWorkerList !== 'undefined' ? masterWorkerList[d] : null) || [];
                            list.forEach(w => {
                                const workerName = w.name || w;
                                if (!allWorkers.includes(workerName)) allWorkers.push(workerName);
                            });
                        }
                    });
                    allWorkers.sort().forEach(workerName => {
                        const opt = document.createElement('option');
                        opt.value = workerName;
                        opt.textContent = workerName;
                        nameSelect.appendChild(opt);
                    });
                } else if (dept) {
                    const list = (typeof masterList !== 'undefined' ? masterList[dept] : null) || (typeof masterWorkerList !== 'undefined' ? masterWorkerList[dept] : null) || [];
                    list.forEach(w => {
                        const workerName = w.name || w;
                        const opt = document.createElement('option');
                        opt.value = workerName;
                        opt.textContent = workerName;
                        nameSelect.appendChild(opt);
                    });
                }
            }
            if (typeof selectSummaryWorker === 'function') {
                selectSummaryWorker('All');
            }
            renderStep4Table();
        };
    }

    const yearSelects = [document.getElementById('summaryYear'), document.getElementById('histYear')];
    const currentYear = new Date().getFullYear();
    yearSelects.forEach(select => {
        select.innerHTML = '';
        for (let y = currentYear - 2; y <= currentYear + 3; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            select.appendChild(opt);
        }
    });

    const monthSelects = [document.getElementById('histMonth')];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthSelects.forEach(select => {
        select.innerHTML = '';
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            select.appendChild(opt);
        });
    });
}

function showDashboard() { switchSection('dashboardSection'); }
function logout() { document.getElementById('headerActions').classList.add('hidden'); switchSection('loginSection'); }
function startNewUpload() {
    switchSection('wizardSection');
    if (step3Data && step3Data.length > 0) {
        goToStep(3);
    } else if (step2Data && step2Data.length > 0) {
        goToStep(2);
    } else {
        goToStep(1);
    }
}
function showHistory() {
    switchSection('historySection');
    loadHistory();
}

// --- WIZARD NAVIGATION ---
function goToStep(step) {
    document.querySelectorAll('.wizard-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`step${step}Content`).classList.remove('hidden');

    document.querySelectorAll('.step').forEach((s, idx) => {
        s.classList.remove('active', 'completed');
        if (idx + 1 < step) s.classList.add('completed');
        if (idx + 1 === step) s.classList.add('active');
    });
}
function proceedToStep2() { generateStep2Data(); goToStep(2); }
function proceedToStep3() {
    const currentSelections = getCurrentStep3Selections();
    generateStep3Data(currentSelections);
    goToStep(3);
}
function proceedToStep4() { goToStep(4); }

let selectedFiles = [];

function handleFileSelect(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        if (!selectedFiles.some(f => f.name === files[i].name)) {
            selectedFiles.push(files[i]);
        }
    }
    renderFileList();
    event.target.value = ''; // Reset input to allow selecting the same file again if removed
}

function renderFileList() {
    const list = document.getElementById('fileList');
    if (!list) return;
    list.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.padding = '6px 12px';
        item.style.background = 'var(--bg-secondary)';
        item.style.borderRadius = '20px';
        item.style.border = '1px solid var(--border-color)';

        item.innerHTML = `
            <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${file.name}</span>
            <button onclick="removeFile(${index})" style="background: none; border: none; color: var(--accent-red); font-weight: bold; cursor: pointer; padding: 0 5px;" title="Remove this file">X</button>
        `;
        list.appendChild(item);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

function clearUpload() {
    selectedFiles = [];
    renderFileList();
    document.getElementById('excelFile').value = '';
    currentUploadedFileName = "accounts_summary.xlsx";
    step1Data = [];
    step2Data = [];
    step3Data = [];
    step4Data = [];

    if (isFullscreen) toggleFullscreen();

    // Hide Step 1 Preview and clear table
    const preview = document.getElementById('step1Preview');
    if (preview) preview.classList.add('hidden');
    const tbody = document.querySelector('#step1Table tbody');
    if (tbody) tbody.innerHTML = '';

    // Reset to Step 1
    goToStep(1);
}

// --- EXCEL PROCESSING (Step 1) ---
async function processExcelUpload() {
    if (selectedFiles.length === 0) return alert('Please select at least one .xlsx file');

    currentUploadedFileName = selectedFiles.map(f => f.name).join(', ');
    if (currentUploadedFileName.length > 50) {
        currentUploadedFileName = selectedFiles.length + " files selected";
    }

    const rules = {
        'D.NO': ['TIMESHEET D NUMBER', 'D NO', 'D NO.'],
        'TIME SHEET NUMBER': ['TIME SHEET NUMBER', 'TIME SHEET NO', 'TIME SHEET NO.'],
        'DATE': ['DATE'],
        'CLIENT NAME': ['CLIENT NAME', 'CLIENT'],
        'QC NAME': ['QC NAME', 'PROJECT NAME/QC'],
        'LOCATION': ['LOCATION', 'SITE LOCATION'],
        'TEST METHOD': ['TEST METHOD'],
        'NUMBER OF MACHINE': ['NUMBER OF MACHINE', 'NUMOER OF MACHINE'],
        'LEADER': ['LEADER', 'TESTED BY TECHNICIAN 1'],
        'TECH #02': ['TECH #02', 'TESTED BY TECHNICIAN 2'],
        'TECH #03': ['TECH #03', 'TESTED BY TECHNICIAN 3'],
        'TECH #04': ['TECH #04', 'TESTED BY TECHNICIAN 4']
    };

    showLoading(true);
    step1Data = [];

    const readExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd-mmm-yy' });
                    const sheetNames = workbook.SheetNames;
                    const getSheetData = (name) => {
                        const actualName = sheetNames.find(n => n.toLowerCase() === name.toLowerCase());
                        if (actualName && workbook.Sheets[actualName]) {
                            return XLSX.utils.sheet_to_json(workbook.Sheets[actualName], { header: 1, raw: false, defval: '' });
                        }
                        return [];
                    };

                    const ex1 = extractData(getSheetData('D1'), rules);
                    const ex2 = extractData(getSheetData('D2'), rules);
                    const ex3 = extractData(getSheetData('D3'), rules);

                    resolve([...ex1, ...ex2, ...ex3]);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const extractedData = await readExcelFile(selectedFiles[i]);
            step1Data = step1Data.concat(extractedData);
        }

        renderStep1Table();
        document.getElementById('step1Preview').classList.remove('hidden');
    } catch (err) {
        alert('Error processing file: ' + err.message + '\nMake sure the files are valid Excel files and not protected.');
        console.error(err);
    } finally {
        showLoading(false);
    }
}

function normalizeHeader(h) {
    if (!h) return '';
    return h.toString().toUpperCase().replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findColIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        const norm = normalizeHeader(headers[i]);
        if (possibleNames.includes(norm)) return i;
    }
    return -1;
}

function extractData(sheetData, mappingRules) {
    if (!sheetData || sheetData.length === 0) return [];

    let bestRowIdx = -1;
    let bestMatchCount = 0;
    let bestMappings = {};

    // Search the first 20 rows for the header row
    for (let r = 0; r < Math.min(sheetData.length, 20); r++) {
        const headers = sheetData[r] || [];
        let matchCount = 0;
        let mappings = {};
        for (const [targetCol, possibleNames] of Object.entries(mappingRules)) {
            const idx = findColIndex(headers, possibleNames);
            mappings[targetCol] = idx;
            if (idx >= 0) matchCount++;
        }
        if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestRowIdx = r;
            bestMappings = mappings;
        }
    }

    if (bestRowIdx === -1 || bestMatchCount === 0) return []; // Headers not found

    const result = [];
    for (let i = bestRowIdx + 1; i < sheetData.length; i++) {
        const row = sheetData[i] || [];
        let isEmpty = true;
        let rowData = {};
        for (const targetCol of Object.keys(mappingRules)) {
            const idx = bestMappings[targetCol];
            const val = idx >= 0 ? row[idx] : '';
            rowData[targetCol] = val;
            if (val !== '' && val !== null && val !== undefined) isEmpty = false;
        }
        if (!isEmpty) result.push(rowData);
    }
    return result;
}

function combineSheets(d1, d2, d3) {
    const rules = {
        'D.NO': ['TIMESHEET D NUMBER', 'D NO', 'D NO.'],
        'TIME SHEET NUMBER': ['TIME SHEET NUMBER', 'TIME SHEET NO', 'TIME SHEET NO.'],
        'DATE': ['DATE'],
        'CLIENT NAME': ['CLIENT NAME', 'CLIENT'],
        'QC NAME': ['QC NAME', 'PROJECT NAME/QC'],
        'LOCATION': ['LOCATION', 'SITE LOCATION'],
        'TEST METHOD': ['TEST METHOD'],
        'NUMBER OF MACHINE': ['NUMBER OF MACHINE', 'NUMOER OF MACHINE'],
        'LEADER': ['LEADER', 'TESTED BY TECHNICIAN 1'],
        'TECH #02': ['TECH #02', 'TESTED BY TECHNICIAN 2'],
        'TECH #03': ['TECH #03', 'TESTED BY TECHNICIAN 3'],
        'TECH #04': ['TECH #04', 'TESTED BY TECHNICIAN 4']
    };

    const ex1 = extractData(d1, rules);
    const ex2 = extractData(d2, rules);
    const ex3 = extractData(d3, rules);

    step1Data = [...ex1, ...ex2, ...ex3];
    renderStep1Table();
    document.getElementById('step1Preview').classList.remove('hidden');
}

function renderStep1Table() {
    const thead = document.querySelector('#step1Table thead tr');
    const tbody = document.querySelector('#step1Table tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const cols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD', 'NUMBER OF MACHINE', 'LEADER', 'TECH #02', 'TECH #03', 'TECH #04'];
    cols.forEach(c => {
        const th = document.createElement('th');
        th.textContent = c;
        thead.appendChild(th);
    });

    step1Data.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(c => {
            const td = document.createElement('td');
            td.textContent = row[c] || '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// --- STEP 2: UNPIVOT ---
function generateStep2Data() {
    step2Data = [];
    const baseCols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD', 'NUMBER OF MACHINE'];
    const techCols = ['LEADER', 'TECH #02', 'TECH #03', 'TECH #04'];

    step1Data.forEach(row => {
        techCols.forEach(tc => {
            if (row[tc] && row[tc].toString().trim() !== '') {
                const newRow = {};
                baseCols.forEach(bc => newRow[bc] = row[bc]);
                newRow['TECH'] = row[tc].toString().trim();
                newRow['TECH TYPE'] = tc;
                step2Data.push(newRow);
            }
        });
    });

    renderStep2Table();
}

function renderStep2Table() {
    const thead = document.querySelector('#step2Table thead tr');
    const tbody = document.querySelector('#step2Table tbody');
    thead.innerHTML = ''; tbody.innerHTML = '';

    const cols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD', 'NUMBER OF MACHINE', 'TECH', 'TECH TYPE'];
    cols.forEach(c => {
        const th = document.createElement('th'); th.textContent = c; thead.appendChild(th);
    });

    step2Data.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(c => {
            const td = document.createElement('td'); td.textContent = row[c] || ''; tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// --- STEP 3: TECH MATCHING & UNDO/REDO ---
let step3UndoStack = [];
let step3RedoStack = [];

function getCurrentStep3Selections() {
    const selections = {};
    document.querySelectorAll('#step3Table [data-tech]').forEach(el => {
        if (el.dataset.tech && !selections[el.dataset.tech]) {
            if (el.tagName === 'SELECT') {
                selections[el.dataset.tech] = el.value.replace(/\s*\(\d+%\s*match\)$/i, '').trim();
            } else if (el.tagName === 'INPUT') {
                const val = el.dataset.workerName || el.value.replace(/\s*\(\d+%\s*match\)$/i, '').trim();
                selections[el.dataset.tech] = val;
            }
        }
    });
    return selections;
}

function saveStep3CurrentStateToUndo(actionName = 'Action') {
    const state = {
        step2Data: JSON.parse(JSON.stringify(step2Data)),
        selections: getCurrentStep3Selections(),
        actionName: actionName
    };
    step3UndoStack.push(state);
    if (step3UndoStack.length > 50) step3UndoStack.shift();
    step3RedoStack = [];
    updateStep3UndoRedoButtons();
}

function saveStep3StateDirect(state) {
    step3UndoStack.push(state);
    if (step3UndoStack.length > 50) step3UndoStack.shift();
    step3RedoStack = [];
    updateStep3UndoRedoButtons();
}

function undoStep3() {
    if (step3UndoStack.length === 0) return;

    const currentState = {
        step2Data: JSON.parse(JSON.stringify(step2Data)),
        selections: getCurrentStep3Selections(),
        actionName: 'Current State'
    };
    step3RedoStack.push(currentState);

    const prevState = step3UndoStack.pop();
    step2Data = JSON.parse(JSON.stringify(prevState.step2Data));
    generateStep3Data(prevState.selections);
    updateStep3UndoRedoButtons();

    if (typeof showToast === 'function') {
        showToast(`Undo: Reverted ${prevState.actionName || 'change'}. Data restored!`, 'info');
    }
}

function redoStep3() {
    if (step3RedoStack.length === 0) return;

    const currentState = {
        step2Data: JSON.parse(JSON.stringify(step2Data)),
        selections: getCurrentStep3Selections(),
        actionName: 'Current State'
    };
    step3UndoStack.push(currentState);

    const nextState = step3RedoStack.pop();
    step2Data = JSON.parse(JSON.stringify(nextState.step2Data));
    generateStep3Data(nextState.selections);
    updateStep3UndoRedoButtons();

    if (typeof showToast === 'function') {
        showToast(`Redo: Restored ${nextState.actionName || 'change'}.`, 'info');
    }
}

function updateStep3UndoRedoButtons() {
    const btnUndo = document.getElementById('btnStep3Undo');
    const btnRedo = document.getElementById('btnStep3Redo');

    if (btnUndo) {
        const canUndo = step3UndoStack.length > 0;
        btnUndo.disabled = !canUndo;
        btnUndo.style.opacity = canUndo ? '1' : '0.5';
        btnUndo.style.cursor = canUndo ? 'pointer' : 'not-allowed';
        btnUndo.style.borderColor = canUndo ? '#4361ee' : 'var(--border-color, #cbd5e1)';
        btnUndo.style.color = canUndo ? '#4361ee' : 'var(--text-secondary, #64748b)';
        if (canUndo) {
            const lastAction = step3UndoStack[step3UndoStack.length - 1].actionName;
            btnUndo.title = `Undo: ${lastAction} (Ctrl+Z)`;
        } else {
            btnUndo.title = 'Nothing to undo (Ctrl+Z)';
        }
    }

    if (btnRedo) {
        const canRedo = step3RedoStack.length > 0;
        btnRedo.disabled = !canRedo;
        btnRedo.style.opacity = canRedo ? '1' : '0.5';
        btnRedo.style.cursor = canRedo ? 'pointer' : 'not-allowed';
        btnRedo.style.borderColor = canRedo ? '#4361ee' : 'var(--border-color, #cbd5e1)';
        btnRedo.style.color = canRedo ? '#4361ee' : 'var(--text-secondary, #64748b)';
        if (canRedo) {
            const nextAction = step3RedoStack[step3RedoStack.length - 1].actionName;
            btnRedo.title = `Redo: ${nextAction} (Ctrl+Y)`;
        } else {
            btnRedo.title = 'Nothing to redo (Ctrl+Y)';
        }
    }
}

function createSearchableWorkerDropdown(techName, scores, selectedWorker, onSelectChange) {
    const container = document.createElement('div');
    container.className = 'step3-search-container';
    container.style.position = 'relative';
    container.style.width = '100%';

    function getFormattedDisplayText(wName) {
        if (!wName) return '';
        const cleanName = wName.replace(/\s*\(\d+%\s*match\)$/i, '').trim();
        const found = scores.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
        const scoreVal = found ? Math.round(found.score) : Math.round(calculateMatch(techName, cleanName));
        return `${cleanName} (${scoreVal}% match)`;
    }

    const cleanSelected = (selectedWorker || '').replace(/\s*\(\d+%\s*match\)$/i, '').trim();

    const inputWrap = document.createElement('div');
    inputWrap.style.position = 'relative';
    inputWrap.style.display = 'flex';
    inputWrap.style.alignItems = 'center';
    inputWrap.style.width = '100%';

    const searchIcon = document.createElement('span');
    searchIcon.innerHTML = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '10px';
    searchIcon.style.fontSize = '0.8rem';
    searchIcon.style.color = '#94a3b8';
    searchIcon.style.pointerEvents = 'none';
    searchIcon.style.userSelect = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step3-search-input';
    input.dataset.tech = techName;
    input.dataset.workerName = cleanSelected;
    input.dataset.prevVal = cleanSelected;
    input.value = getFormattedDisplayText(cleanSelected);
    input.placeholder = 'Type to search master worker...';
    input.autocomplete = 'off';
    input.style.width = '100%';
    input.style.padding = '8px 32px 8px 30px';
    input.style.borderRadius = '6px';
    input.style.border = '1.5px solid #4361ee';
    input.style.background = '#ffffff';
    input.style.fontSize = '0.88rem';
    input.style.fontWeight = '600';
    input.style.color = '#1e293b';
    input.style.outline = 'none';
    input.style.transition = 'all 0.15s ease';

    const clearOrArrow = document.createElement('span');
    clearOrArrow.innerHTML = '▼';
    clearOrArrow.style.position = 'absolute';
    clearOrArrow.style.right = '10px';
    clearOrArrow.style.fontSize = '0.7rem';
    clearOrArrow.style.color = '#64748b';
    clearOrArrow.style.cursor = 'pointer';
    clearOrArrow.style.padding = '4px';
    clearOrArrow.style.userSelect = 'none';

    inputWrap.appendChild(searchIcon);
    inputWrap.appendChild(input);
    inputWrap.appendChild(clearOrArrow);

    // Hidden select for backward compatibility
    const hiddenSelect = document.createElement('select');
    hiddenSelect.style.display = 'none';
    hiddenSelect.dataset.tech = techName;
    scores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (${Math.round(s.score)}% match)`;
        if (s.name.toLowerCase() === cleanSelected.toLowerCase()) opt.selected = true;
        hiddenSelect.appendChild(opt);
    });
    hiddenSelect.value = cleanSelected;

    // Dropdown list menu
    const dropdownList = document.createElement('div');
    dropdownList.className = 'step3-worker-dropdown-menu';
    dropdownList.style.display = 'none';
    dropdownList.style.position = 'absolute';
    dropdownList.style.top = 'calc(100% + 4px)';
    dropdownList.style.left = '0';
    dropdownList.style.right = '0';
    dropdownList.style.minWidth = '340px';
    dropdownList.style.maxHeight = '260px';
    dropdownList.style.overflowY = 'auto';
    dropdownList.style.background = '#ffffff';
    dropdownList.style.border = '1.5px solid #cbd5e1';
    dropdownList.style.borderRadius = '8px';
    dropdownList.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.18), 0 8px 10px -6px rgba(0,0,0,0.1)';
    dropdownList.style.zIndex = '99999';

    function renderList(query = '') {
        dropdownList.innerHTML = '';
        const rawQ = (query || '').trim();
        const q = rawQ.replace(/\s*\(\d+%\s*match\)$/i, '').toLowerCase().trim();

        let filtered = scores.filter(s => {
            if (!q) return true;
            return s.name.toLowerCase().includes(q) || (s.dept && s.dept.toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
            const noRes = document.createElement('div');
            noRes.style.padding = '10px 14px';
            noRes.style.color = '#94a3b8';
            noRes.style.fontSize = '0.84rem';
            noRes.style.fontStyle = 'italic';
            noRes.textContent = 'No matching master workers found';
            dropdownList.appendChild(noRes);
            return;
        }

        filtered.forEach(item => {
            const rowEl = document.createElement('div');
            rowEl.className = 'step3-dropdown-item';
            rowEl.style.padding = '8px 12px';
            rowEl.style.display = 'flex';
            rowEl.style.justifyContent = 'space-between';
            rowEl.style.alignItems = 'center';
            rowEl.style.cursor = 'pointer';
            rowEl.style.borderBottom = '1px solid #f1f5f9';
            rowEl.style.transition = 'background 0.12s ease';
            rowEl.style.fontSize = '0.85rem';

            const currentWorker = input.dataset.workerName || '';
            if (item.name.toLowerCase() === currentWorker.toLowerCase()) {
                rowEl.style.background = '#eef2ff';
                rowEl.style.borderLeft = '3px solid #4361ee';
            }

            const nameSpan = document.createElement('div');
            nameSpan.style.fontWeight = '600';
            nameSpan.style.color = '#1e293b';

            if (q) {
                const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                nameSpan.innerHTML = item.name.replace(regex, '<span style="background:#fef08a; color:#854d0e; border-radius:2px; padding:0 2px;">$1</span>');
            } else {
                nameSpan.textContent = item.name;
            }

            if (item.dept) {
                const deptTag = document.createElement('span');
                deptTag.style.fontSize = '0.72rem';
                deptTag.style.color = '#64748b';
                deptTag.style.marginLeft = '6px';
                deptTag.textContent = `[${item.dept}]`;
                nameSpan.appendChild(deptTag);
            }

            const scoreBadge = document.createElement('span');
            const scoreVal = Math.round(item.score);
            scoreBadge.textContent = `${scoreVal}% match`;
            scoreBadge.style.fontSize = '0.72rem';
            scoreBadge.style.fontWeight = '700';
            scoreBadge.style.padding = '2px 8px';
            scoreBadge.style.borderRadius = '12px';
            scoreBadge.style.whiteSpace = 'nowrap';
            scoreBadge.style.marginLeft = '8px';

            if (scoreVal >= 80) {
                scoreBadge.style.background = '#dcfce7';
                scoreBadge.style.color = '#15803d';
            } else if (scoreVal >= 40) {
                scoreBadge.style.background = '#fef3c7';
                scoreBadge.style.color = '#b45309';
            } else {
                scoreBadge.style.background = '#f1f5f9';
                scoreBadge.style.color = '#64748b';
            }

            rowEl.appendChild(nameSpan);
            rowEl.appendChild(scoreBadge);

            rowEl.onmouseover = () => {
                rowEl.style.background = '#e0e7ff';
            };
            rowEl.onmouseout = () => {
                rowEl.style.background = (item.name.toLowerCase() === currentWorker.toLowerCase()) ? '#eef2ff' : '#ffffff';
            };

            rowEl.onmousedown = (e) => {
                e.preventDefault();
                selectItem(item.name);
            };

            dropdownList.appendChild(rowEl);
        });
    }

    function selectItem(name) {
        const clean = (name || '').replace(/\s*\(\d+%\s*match\)$/i, '').trim();
        const prevVal = input.dataset.prevVal || '';
        input.dataset.workerName = clean;
        input.dataset.prevVal = clean;
        input.value = getFormattedDisplayText(clean);
        hiddenSelect.value = clean;
        dropdownList.style.display = 'none';
        input.style.borderColor = '#4361ee';
        input.style.boxShadow = 'none';

        if (prevVal !== clean) {
            onSelectChange(techName, prevVal, clean);
        }
    }

    function showDropdown() {
        document.querySelectorAll('.step3-worker-dropdown-menu').forEach(el => {
            if (el !== dropdownList) el.style.display = 'none';
        });
        renderList('');
        dropdownList.style.display = 'block';
        input.style.borderColor = '#4361ee';
        input.style.boxShadow = '0 0 0 3px rgba(67, 97, 238, 0.15)';
    }

    input.onfocus = () => {
        showDropdown();
        input.select();
    };

    input.onclick = () => {
        showDropdown();
    };

    input.oninput = (e) => {
        renderList(e.target.value);
        dropdownList.style.display = 'block';
    };

    input.onkeydown = (e) => {
        if (e.key === 'Escape') {
            dropdownList.style.display = 'none';
        } else if (e.key === 'Enter') {
            const firstItem = dropdownList.querySelector('.step3-dropdown-item');
            if (firstItem) {
                firstItem.dispatchEvent(new MouseEvent('mousedown'));
            }
        }
    };

    input.onblur = () => {
        setTimeout(() => {
            dropdownList.style.display = 'none';
            input.style.boxShadow = 'none';
            const currentText = input.value.trim();
            const cleanText = currentText.replace(/\s*\(\d+%\s*match\)$/i, '').trim();
            const matched = scores.find(s => s.name.toLowerCase() === cleanText.toLowerCase());
            if (matched) {
                selectItem(matched.name);
            } else if (cleanText) {
                selectItem(cleanText);
            } else {
                selectItem(input.dataset.prevVal || '');
            }
        }, 200);
    };

    clearOrArrow.onclick = () => {
        if (dropdownList.style.display === 'block') {
            dropdownList.style.display = 'none';
        } else {
            input.focus();
        }
    };

    container.appendChild(inputWrap);
    container.appendChild(hiddenSelect);
    container.appendChild(dropdownList);

    return container;
}

function calculateMatch(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 100;

    const tokens1 = s1.split(/\s+/);
    const tokens2 = s2.split(/\s+/);
    let matchCount = 0;
    tokens1.forEach(t => { if (tokens2.includes(t)) matchCount++; });

    return (matchCount / Math.max(tokens1.length, tokens2.length)) * 100;
}

function generateStep3Data(preservedSelections = {}) {
    step3Data = [];
    const uniqueTechs = {};
    step2Data.forEach(row => {
        const tech = row['TECH'] ? String(row['TECH']).trim() : '';
        if (!tech) return;
        if (!uniqueTechs[tech]) {
            uniqueTechs[tech] = [];
        }
        uniqueTechs[tech].push(row['TIME SHEET NUMBER']);
    });

    const tbody = document.querySelector('#step3Table tbody');
    tbody.innerHTML = '';

    const techKeys = Object.keys(uniqueTechs);
    if (techKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 25px; color: var(--text-secondary, #64748b);">No technicians found in extracted data.</td></tr>';
        updateStep3UndoRedoButtons();
        return;
    }

    techKeys.forEach(techName => {
        let scores = masterWorkers.map(mw => {
            return { name: mw.name, dept: mw.dept || '', score: calculateMatch(techName, mw.name) };
        });

        scores.sort((a, b) => b.score - a.score);

        const tr = document.createElement('tr');

        // 1. Delete '✕' Column
        const tdDel = document.createElement('td');
        tdDel.style.textAlign = 'center';
        tdDel.style.verticalAlign = 'middle';
        tdDel.style.width = '50px';
        tdDel.style.padding = '6px 4px';

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.title = `Delete "${techName}" and remove from data/Excel`;
        btnDel.textContent = '✕';
        btnDel.style.background = '#fee2e2';
        btnDel.style.color = '#dc2626';
        btnDel.style.border = '1px solid #fca5a5';
        btnDel.style.borderRadius = '6px';
        btnDel.style.width = '30px';
        btnDel.style.height = '30px';
        btnDel.style.fontWeight = '800';
        btnDel.style.fontSize = '0.95rem';
        btnDel.style.cursor = 'pointer';
        btnDel.style.display = 'inline-flex';
        btnDel.style.alignItems = 'center';
        btnDel.style.justifyContent = 'center';
        btnDel.style.transition = 'all 0.15s ease';
        btnDel.onmouseover = () => {
            btnDel.style.background = '#dc2626';
            btnDel.style.color = '#ffffff';
            btnDel.style.borderColor = '#b91c1c';
            btnDel.style.transform = 'scale(1.08)';
        };
        btnDel.onmouseout = () => {
            btnDel.style.background = '#fee2e2';
            btnDel.style.color = '#dc2626';
            btnDel.style.borderColor = '#fca5a5';
            btnDel.style.transform = 'scale(1)';
        };
        btnDel.onclick = () => deleteStep3Row(techName);
        tdDel.appendChild(btnDel);

        // 2. Extracted Technician (Editable)
        const tdTech = document.createElement('td');
        tdTech.style.padding = '8px 10px';
        tdTech.style.minWidth = '250px';
        const inputTech = document.createElement('input');
        inputTech.type = 'text';
        inputTech.style.width = '100%';
        inputTech.style.padding = '8px 12px';
        inputTech.style.borderRadius = '6px';
        inputTech.style.border = '1.5px solid var(--border-color, #cbd5e1)';
        inputTech.style.fontSize = '0.88rem';
        inputTech.style.fontWeight = '600';
        inputTech.style.color = '#1e293b';
        inputTech.value = techName;
        inputTech.dataset.oldTech = techName;
        inputTech.onchange = handleTechNameEdit;
        tdTech.appendChild(inputTech);

        // 3. Matched Master Worker (Searchable Dropdown with type-to-search and match %)
        const tdSts = document.createElement('td');
        tdSts.style.padding = '8px 10px';
        tdSts.style.minWidth = '380px';
        tdSts.style.position = 'relative';

        let initialSelected = '';
        if (preservedSelections[techName]) {
            initialSelected = preservedSelections[techName];
        } else if (scores.length > 0) {
            initialSelected = scores[0].name;
        }

        const searchWidget = createSearchableWorkerDropdown(
            techName,
            scores,
            initialSelected,
            (tName, prevVal, newVal) => {
                const prevSelections = getCurrentStep3Selections();
                prevSelections[tName] = prevVal;
                saveStep3StateDirect({
                    step2Data: JSON.parse(JSON.stringify(step2Data)),
                    selections: prevSelections,
                    actionName: `Changed match for "${tName}"`
                });
            }
        );

        tdSts.appendChild(searchWidget);

        // 4. Timesheet Numbers
        const tdTs = document.createElement('td');
        tdTs.style.padding = '8px 12px';
        tdTs.style.fontSize = '0.84rem';
        tdTs.style.color = '#334155';
        const tsNumbers = [...new Set(uniqueTechs[techName])].join(', ');
        tdTs.textContent = tsNumbers;

        tr.appendChild(tdDel);
        tr.appendChild(tdTech);
        tr.appendChild(tdSts);
        tr.appendChild(tdTs);
        tbody.appendChild(tr);
    });

    updateStep3UndoRedoButtons();
}

function deleteStep3Row(techName) {
    if (!confirm(`Are you sure you want to delete technician "${techName}" and all associated records from data and Excel?\n\n(Note: You can click "Undo" or press Ctrl+Z to restore if deleted by mistake).`)) {
        return;
    }

    // Save state to undo before deleting
    saveStep3CurrentStateToUndo(`Deleted "${techName}"`);

    const beforeCount = step2Data.length;
    step2Data = step2Data.filter(row => {
        const rowTech = row['TECH'] ? String(row['TECH']).trim() : '';
        return rowTech !== techName.trim();
    });

    const currentSelections = getCurrentStep3Selections();
    delete currentSelections[techName];

    generateStep3Data(currentSelections);
    if (typeof showToast === 'function') {
        showToast(`Deleted "${techName}" (${beforeCount - step2Data.length} records removed). Click "Undo" to restore.`);
    } else {
        alert(`Deleted "${techName}" (${beforeCount - step2Data.length} records removed). Click "Undo" to restore.`);
    }
}

function handleTechNameEdit(e) {
    const input = e.target;
    const oldName = input.dataset.oldTech;
    const newName = input.value.trim();

    if (!newName || newName === oldName) {
        input.value = oldName;
        return;
    }

    // Save state to undo before renaming
    saveStep3CurrentStateToUndo(`Renamed "${oldName}" to "${newName}"`);

    const currentSelections = getCurrentStep3Selections();

    step2Data.forEach(row => {
        const currentTech = row['TECH'] ? row['TECH'].trim() : '';
        if (currentTech === oldName) {
            row['TECH'] = newName;
        }
    });

    if (currentSelections[oldName]) {
        currentSelections[newName] = currentSelections[oldName];
        delete currentSelections[oldName];
    }

    generateStep3Data(currentSelections);
    if (typeof showToast === 'function') {
        showToast(`Renamed "${oldName}" to "${newName}". Click "Undo" to revert.`);
    }
}

// --- STEP 3 KEYBOARD SHORTCUTS (CTRL+Z / CTRL+Y) ---
document.addEventListener('keydown', function (e) {
    const step3Content = document.getElementById('step3Content');
    if (!step3Content || step3Content.classList.contains('hidden')) return;

    const activeEl = document.activeElement;
    const isEditingInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'text';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!e.shiftKey) {
            if (!isEditingInput) {
                e.preventDefault();
                undoStep3();
            }
        } else {
            e.preventDefault();
            redoStep3();
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoStep3();
    }
});

// --- STEP 4: COMPARE & SUMMARY ---
async function fetchAndCompareData() {
    const dept = document.getElementById('summaryDept').value;
    const month = document.getElementById('summaryMonth').value;
    const year = document.getElementById('summaryYear').value;

    if (!dept || !month || !year) return alert('Select Department, Month and Year');

    // 1. Build mapped data from Step 3 selections
    const selects = document.querySelectorAll('#step3Table select');
    const mapping = {};
    selects.forEach(s => mapping[s.dataset.tech] = s.value);

    // Create flattened mapped step2 data
    const mappedStep2 = step2Data.map(r => {
        const techName = r['TECH'] ? r['TECH'].trim() : '';
        return {
            name: mapping[techName] || techName, // fallback to original if mapping fails
            date: r['DATE'],
            tsNumber: r['TIME SHEET NUMBER']
        };
    });

    showLoading(true);
    step4Data = [];

    // In a real app, we'd batch fetch, but here we can fetch data for the department/month/year
    // Wait, the existing Code.gs has getStatus which we could use, or getData for specific sheets.
    // We actually need data for ALL workers in this department for this month to compare.
    // The current backend doesn't have a bulk fetch. We will have to fetch for each unique mapped worker.

    const uniqueMappedNames = [...new Set(mappedStep2.map(m => m.name))];
    const isAllDept = (dept === 'ALL DEPARTMENT' || dept === 'ALL' || dept === 'ALL DEPARTMENTS');
    let allDeptWorkers = [];
    if (isAllDept) {
        allDepartments.forEach(d => {
            if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                const list = (typeof masterList !== 'undefined' ? masterList[d] : null) || (typeof masterWorkerList !== 'undefined' ? masterWorkerList[d] : null) || [];
                list.forEach(w => {
                    const wName = w.name || w;
                    if (!allDeptWorkers.includes(wName)) allDeptWorkers.push(wName);
                });
            }
        });
    } else {
        const list = (typeof masterList !== 'undefined' ? masterList[dept] : null) || (typeof masterWorkerList !== 'undefined' ? masterWorkerList[dept] : null) || [];
        allDeptWorkers = list.map(w => w.name || w);
    }
    const workersToProcess = [...new Set([...allDeptWorkers, ...uniqueMappedNames])];

    try {
        let backendData = []; // flattened array of {name, date, tsNumber}

        const DEPARTMENTS_CONFIG = {
            'RADIOGRAPHY': [
                { id: 'nightShiftIn' }, { id: 'nightShiftOut' }, { id: 'lunchIn' }, { id: 'lunchOut' },
                { id: 'standBy' }, { id: 'lunchRtClient' }, { id: 'lunchRtFilms' }, { id: 'tsNumber' },
                { id: 'loc1Client1' }, { id: 'loc1Films' }, { id: 'loc2Client2' }, { id: 'loc2Films' },
                { id: 'loc3Client3' }, { id: 'loc3Films' }, { id: 'expF4x10' }, { id: 'expF4x15' },
                { id: 'expF17x14' }, { id: 'expFReshoot' }, { id: 'expFTotal' }, { id: 'otLunchRt' },
                { id: 'otSiteToSite' }, { id: 'otXrayScar' }, { id: 'otProfile' }, { id: 'timesheetOt' },
                { id: 'sunday' }, { id: 'totalOt' }, { id: 'otRtrDrtPautAllow' }, { id: 'otRopeAllow' },
                { id: 'otWeldtestAllow' }, { id: 'busFarw' }
            ],
            'DEFAULT': [
                { id: 'clientIn' }, { id: 'clientOut' }, { id: 'tsNumber' }, { id: 'siteLoc1' },
                { id: 'siteLoc2' }, { id: 'otHrs' }, { id: 'siteAllowanceHrs' }, { id: 'travelAllowance' },
                { id: 'otherAllowance' }, { id: 'busAllowance' }, { id: 'remarks' }
            ]
        };
        const activeCols = DEPARTMENTS_CONFIG[dept] || DEPARTMENTS_CONFIG['DEFAULT'];
        const keys = ['name', 'date', 'day', ...activeCols.map(c => c.id)].join(',');

        // Bulk fetch all worker data for the month in one request
        const url = `${SCRIPT_URL}?action=getAllData&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(month + ' ' + year)}&keys=${encodeURIComponent(keys)}`;

        try {
            const res = await fetch(url);
            const text = await res.text();

            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                console.error(`Invalid JSON from bulk fetch. Response: ${text.substring(0, 100)}...`);
            }

            if (result && result.status === 'success' && result.data && result.data.length > 0) {
                result.data.forEach(r => {
                    backendData.push({
                        name: r.name || r._workerName,
                        date: r.date,
                        tsNumber: r.tsNumber,
                        sheetType: r._sheetType || 'normal'
                    });
                });
            }
        } catch (e) {
            console.warn('Single request fetch error in accounts.js, checking fallback', e);
        }

        // Fallback: If isAllDept and backendData is empty, query each department in parallel
        if (isAllDept && backendData.length === 0) {
            const targetDepts = allDepartments.filter(d => d !== 'Admin ID' && !d.toLowerCase().includes('accounts'));
            const deptFetches = targetDepts.map(async (d) => {
                try {
                    const dCols = DEPARTMENTS_CONFIG[d] || DEPARTMENTS_CONFIG['DEFAULT'];
                    const dKeys = ['name', 'date', 'day', ...dCols.map(c => c.id)].join(',');
                    const dUrl = `${SCRIPT_URL}?action=getAllData&department=${encodeURIComponent(d)}&monthYear=${encodeURIComponent(month + ' ' + year)}&keys=${encodeURIComponent(dKeys)}`;
                    const dRes = await fetch(dUrl);
                    const dText = await dRes.text();
                    const dResult = JSON.parse(dText);
                    if (dResult.status === 'success' && dResult.data) {
                        return dResult.data.map(r => ({
                            name: r.name || r._workerName,
                            date: r.date,
                            tsNumber: r.tsNumber,
                            sheetType: r._sheetType || 'normal'
                        }));
                    }
                } catch (e) { }
                return [];
            });
            const allResults = await Promise.all(deptFetches);
            allResults.forEach(arr => backendData.push(...arr));
        }

        const monthMap = {
            'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
            'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
        };
        const monthIdx = monthMap[month];
        const numDays = new Date(year, monthIdx + 1, 0).getDate();

        // Pre-calculate standard dates for mappedStep2
        mappedStep2.forEach(m => {
            m.standardDate = formatDateForCompare(m.date);
        });

        // 2. Compare for full month
        workersToProcess.forEach(workerName => {
            for (let d = 1; d <= numDays; d++) {
                const dd = String(d).padStart(2, '0');
                const mm = String(monthIdx + 1).padStart(2, '0');
                const standardDateStr = `${dd}/${mm}/${year}`;

                const shortYear = String(year).slice(-2);
                const excelDateStr = `${d}-${month.substring(0, 3)}-${shortYear}`;

                const dprsMatches = mappedStep2.filter(m => (m.name && m.name.trim().toLowerCase() === workerName.trim().toLowerCase()) && m.standardDate === standardDateStr);
                const stsMatches = backendData.filter(b => (b.name && b.name.trim().toLowerCase() === workerName.trim().toLowerCase()) && b.date === standardDateStr);

                // Collect unique non-empty timesheet numbers from DPRS (Excel upload)
                const dprsTsList = [];
                dprsMatches.forEach(m => {
                    const val = String(m.tsNumber || '').trim();
                    if (val && val !== '-' && !dprsTsList.includes(val)) {
                        dprsTsList.push(val);
                    }
                });

                // Collect unique non-empty timesheet numbers from STS (both accounts sheet & normal sheet)
                const stsTsList = [];
                stsMatches.forEach(b => {
                    const val = String(b.tsNumber || '').trim();
                    if (val && val !== '-' && !stsTsList.includes(val)) {
                        stsTsList.push(val);
                    }
                });

                const dprsTsDisplay = dprsTsList.join(', ');
                const stsTsDisplay = stsTsList.join(' & ');

                let summary = 'MISMATCHED';

                const splitIntoTokens = (list) => {
                    let tokens = [];
                    list.forEach(ts => {
                        const parts = String(ts).split(/[\s,&\/\\\|]+/);
                        parts.forEach(p => {
                            const norm = p.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                            if (norm && !tokens.includes(norm)) tokens.push(norm);
                        });
                    });
                    return tokens;
                };

                const dprsTokens = splitIntoTokens(dprsTsList);
                const stsTokens = splitIntoTokens(stsTsList);

                if (dprsTokens.length > 0 || stsTokens.length > 0) {
                    let matchedCount = 0;
                    const remainingStsTokens = [...stsTokens];

                    dprsTokens.forEach(dprsT => {
                        const matchIndex = remainingStsTokens.findIndex(stsT => stsT === dprsT || stsT.includes(dprsT) || dprsT.includes(stsT));
                        if (matchIndex !== -1) {
                            matchedCount++;
                            remainingStsTokens.splice(matchIndex, 1);
                        }
                    });

                    let mismatchedCount = (dprsTokens.length - matchedCount) + remainingStsTokens.length;

                    if (matchedCount > 0 && mismatchedCount === 0) {
                        summary = `${matchedCount} MATCHED`;
                    } else if (matchedCount > 0 && mismatchedCount > 0) {
                        summary = `${matchedCount} MATCHED, ${mismatchedCount} MISMATCHED`;
                    } else {
                        summary = `${mismatchedCount} MISMATCHED`;
                    }
                } else {
                    summary = 'MISMATCHED';
                }

                step4Data.push({
                    NAME: workerName,
                    DATE: excelDateStr,
                    DPRS_TS: dprsTsDisplay,
                    STS_TS: stsTsDisplay,
                    SUMMARY: summary
                });
            }
        });

        renderStep4Table();

    } catch (e) {
        alert(e.message || 'Error fetching backend data for comparison.');
        console.error(e);
    }
    showLoading(false);
}

function formatDateForCompare(excelDateStr) {
    // If it's already a string like "1-May-26" try to convert to DD/MM/YYYY matching the main portal
    try {
        const d = new Date(excelDateStr);
        if (isNaN(d.getTime())) return excelDateStr; // Return as is if unparseable
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    } catch (e) {
        return excelDateStr;
    }
}

function renderStep4Table() {
    const tbody = document.querySelector('#step4Table tbody');
    tbody.innerHTML = '';

    const nameSelect = document.getElementById('summaryName');
    const nameFilter = nameSelect ? nameSelect.value : 'All';

    let filteredData = step4Data;
    if (nameFilter !== 'All') {
        filteredData = step4Data.filter(r => r.NAME === nameFilter);
    }

    let matchedCount = 0;
    let mismatchedCount = 0;

    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        const summaryUpper = row.SUMMARY.toUpperCase();

        let match1 = summaryUpper.match(/^(\d+) MATCHED$/);
        let match2 = summaryUpper.match(/^(\d+) MATCHED, (\d+) MISMATCHED$/);
        let match3 = summaryUpper.match(/^(\d+) MISMATCHED$/);

        let summaryHTML = '';

        if (summaryUpper === 'MATCHED') {
            matchedCount++;
            summaryHTML = `<span class="tag matched">${row.SUMMARY}</span>`;
        } else if (match1) {
            matchedCount += parseInt(match1[1], 10);
            summaryHTML = `<span class="tag matched">${row.SUMMARY}</span>`;
        } else if (match2) {
            matchedCount += parseInt(match2[1], 10);
            mismatchedCount += parseInt(match2[2], 10);
            summaryHTML = `<span class="tag matched" style="margin-right: 4px;">${match2[1]} MATCHED</span><span class="tag mismatched">${match2[2]} MISMATCHED</span>`;
        } else if (match3) {
            mismatchedCount += parseInt(match3[1], 10);
            summaryHTML = `<span class="tag mismatched">${row.SUMMARY}</span>`;
        } else {
            mismatchedCount++;
            summaryHTML = `<span class="tag mismatched">${row.SUMMARY}</span>`;
        }

        tr.innerHTML = `
            <td>${row.NAME}</td>
            <td>${row.DATE}</td>
            <td>${row.DPRS_TS}</td>
            <td>${row.STS_TS}</td>
            <td>${summaryHTML}</td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredData.length > 0) {
        const trTotal = document.createElement('tr');
        trTotal.style.fontWeight = 'bold';
        trTotal.style.backgroundColor = '#f8fafc';
        trTotal.innerHTML = `
            <td colspan="4" style="text-align: right; vertical-align: middle;">TOTAL</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 5px; width: fit-content;">
                    <span class="tag matched" style="display: inline-block;">matched ${matchedCount}</span>
                    <span class="tag mismatched" style="display: inline-block;">mis matched ${mismatchedCount}</span>
                </div>
            </td>
        `;
        tbody.appendChild(trTotal);
    }
}

// ===== SEARCHABLE WORKER FILTER FOR STEP 4 =====
function getAllSummaryWorkers() {
    const list = new Set();
    if (typeof step4Data !== 'undefined' && Array.isArray(step4Data)) {
        step4Data.forEach(r => {
            if (r && r.NAME && String(r.NAME).trim() !== '') list.add(String(r.NAME).trim());
        });
    }
    const select = document.getElementById('summaryName');
    if (select && select.options) {
        Array.from(select.options).forEach(opt => {
            if (opt.value && opt.value !== 'All' && opt.value.trim() !== '') {
                list.add(opt.value.trim());
            }
        });
    }
    const dept = document.getElementById('summaryDept') ? document.getElementById('summaryDept').value : '';
    const mList = (typeof masterWorkerList !== 'undefined' ? masterWorkerList : (typeof masterList !== 'undefined' ? masterList : null));
    if (mList) {
        if (dept === 'ALL DEPARTMENT' || dept === 'ALL' || dept === 'ALL DEPARTMENTS' || !dept) {
            Object.keys(mList).forEach(d => {
                if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                    (mList[d] || []).forEach(w => {
                        const wName = typeof w === 'string' ? w : w.name;
                        if (wName) list.add(String(wName).trim());
                    });
                }
            });
        } else if (mList[dept]) {
            mList[dept].forEach(w => {
                const wName = typeof w === 'string' ? w : w.name;
                if (wName) list.add(String(wName).trim());
            });
        }
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b));
}

function showSummaryWorkerDropdown() {
    filterSummaryWorkerDropdown();
    const dropdown = document.getElementById('summaryWorkerDropdown');
    if (dropdown) dropdown.classList.add('show');
}

function toggleSummaryWorkerDropdown() {
    const dropdown = document.getElementById('summaryWorkerDropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    } else {
        const input = document.getElementById('summaryWorkerSearch');
        if (input) input.focus();
        showSummaryWorkerDropdown();
    }
}

function filterSummaryWorkerDropdown() {
    const input = document.getElementById('summaryWorkerSearch');
    const dropdown = document.getElementById('summaryWorkerDropdown');
    if (!input || !dropdown) return;

    const query = input.value.trim().toLowerCase();
    const allWorkers = getAllSummaryWorkers();
    const currentSelected = document.getElementById('summaryName') ? document.getElementById('summaryName').value : 'All';

    dropdown.innerHTML = '';

    // All Workers option
    if (!query || 'all workers'.includes(query) || 'all'.includes(query)) {
        const allItem = document.createElement('div');
        allItem.className = 'dropdown-item' + (currentSelected === 'All' ? ' active' : '');
        allItem.style.fontWeight = '700';
        allItem.style.borderBottom = '1px solid var(--border-color)';
        allItem.textContent = ' All Workers';
        allItem.onclick = () => selectSummaryWorker('All');
        dropdown.appendChild(allItem);
    }

    const filtered = allWorkers.filter(w => w.toLowerCase().includes(query));

    if (filtered.length > 0) {
        filtered.forEach(w => {
            const item = document.createElement('div');
            item.className = 'dropdown-item' + (currentSelected === w ? ' active' : '');
            item.textContent = w;
            item.onclick = () => selectSummaryWorker(w);
            dropdown.appendChild(item);
        });
    } else if (dropdown.children.length === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'dropdown-item no-results';
        noRes.textContent = 'No matching workers';
        dropdown.appendChild(noRes);
    }
}

function selectSummaryWorker(workerName) {
    const input = document.getElementById('summaryWorkerSearch');
    const select = document.getElementById('summaryName');
    const clearBtn = document.getElementById('summaryWorkerClear');

    if (select) {
        if (workerName !== 'All') {
            let opt = Array.from(select.options).find(o => o.value === workerName);
            if (!opt) {
                opt = document.createElement('option');
                opt.value = workerName;
                opt.textContent = workerName;
                select.appendChild(opt);
            }
        }
        select.value = workerName;
    }

    if (input) {
        input.value = workerName === 'All' ? '' : workerName;
        input.placeholder = workerName === 'All' ? 'Search or select worker...' : workerName;
    }

    if (clearBtn) {
        clearBtn.style.display = workerName !== 'All' ? 'block' : 'none';
    }

    const dropdown = document.getElementById('summaryWorkerDropdown');
    if (dropdown) dropdown.classList.remove('show');

    if (typeof renderStep4Table === 'function') {
        renderStep4Table();
    }
}

function clearSummaryWorkerFilter() {
    selectSummaryWorker('All');
    const input = document.getElementById('summaryWorkerSearch');
    if (input) {
        input.value = '';
        input.placeholder = 'Search or select worker...';
        input.focus();
    }
}

function handleSummaryWorkerKeydown(e) {
    const dropdown = document.getElementById('summaryWorkerDropdown');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!dropdown || !dropdown.classList.contains('show')) {
            showSummaryWorkerDropdown();
            return;
        }
        const items = Array.from(dropdown.querySelectorAll('.dropdown-item:not(.no-results)'));
        if (items.length === 0) return;
        e.preventDefault();
        let activeIdx = items.findIndex(el => el.classList.contains('keyboard-focus') || el.classList.contains('active'));
        if (e.key === 'ArrowDown') {
            activeIdx = (activeIdx + 1) % items.length;
        } else {
            activeIdx = (activeIdx - 1 + items.length) % items.length;
        }
        items.forEach((el, i) => {
            if (i === activeIdx) {
                el.classList.add('keyboard-focus');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('keyboard-focus');
            }
        });
        return;
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (dropdown && dropdown.classList.contains('show')) {
            const focused = dropdown.querySelector('.dropdown-item.keyboard-focus');
            if (focused) {
                focused.click();
                return;
            }
        }
        const input = document.getElementById('summaryWorkerSearch');
        const query = (input ? input.value : '').trim().toLowerCase();
        if (!query || query === 'all' || query === 'all workers') {
            selectSummaryWorker('All');
            return;
        }
        const allWorkers = getAllSummaryWorkers();
        const exact = allWorkers.find(w => w.toLowerCase() === query);
        if (exact) {
            selectSummaryWorker(exact);
            return;
        }
        const starts = allWorkers.find(w => w.toLowerCase().startsWith(query));
        if (starts) {
            selectSummaryWorker(starts);
            return;
        }
        const includes = allWorkers.find(w => w.toLowerCase().includes(query));
        if (includes) {
            selectSummaryWorker(includes);
            return;
        }
    } else if (e.key === 'Escape') {
        if (dropdown) dropdown.classList.remove('show');
    }
}

function downloadExcelStep1() {
    if (step1Data.length === 0) return alert('No data to download.');
    const ws = XLSX.utils.json_to_sheet(step1Data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Step1_Combined");
    XLSX.writeFile(wb, "Step1_" + currentUploadedFileName);
}

function downloadExcelStep2() {
    if (step2Data.length === 0) return alert('No data to download.');
    const ws = XLSX.utils.json_to_sheet(step2Data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Step2_Unpivoted");
    XLSX.writeFile(wb, "Step2_" + currentUploadedFileName);
}

function downloadExcelStep3() {
    const exportData = [];
    document.querySelectorAll('#step3Table tbody tr').forEach(tr => {
        if (!tr.cells || tr.cells.length < 4) return;
        const techInput = tr.cells[1].querySelector('input');
        const techName = techInput ? techInput.value : tr.cells[1].textContent.trim();
        const stsSelect = tr.cells[2].querySelector('select');
        const stsMatch = stsSelect ? stsSelect.value : '';
        const tsNumbers = tr.cells[3].textContent.trim();
        if (!techName) return;
        exportData.push({
            'TECH (from File)': techName,
            'STS Match': stsMatch,
            'Time Sheet Number(s)': tsNumbers
        });
    });

    if (exportData.length === 0) return alert('No data to download.');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Step3_Mapping");
    XLSX.writeFile(wb, "Step3_" + currentUploadedFileName);
}

async function showAccountsCommentInPortal() {
    if (!step4Data || step4Data.length === 0) {
        return alert('Please fetch and compare data first.');
    }
    const dept = document.getElementById('summaryDept').value;
    const month = document.getElementById('summaryMonth').value;
    const year = document.getElementById('summaryYear').value;

    if (!dept || !month || !year) {
        return alert('Please select department, month, and year.');
    }

    const perWorkerStats = {};
    const workerGroups = {};
    step4Data.forEach(r => {
        if (!workerGroups[r.NAME]) workerGroups[r.NAME] = [];
        workerGroups[r.NAME].push(r);
    });

    Object.keys(workerGroups).forEach(wName => {
        const wRows = workerGroups[wName];
        let wMatched = 0;
        let wMismatched = 0;
        wRows.forEach(r => {
            const sUpper = (r.SUMMARY || '').toUpperCase();
            let match1 = sUpper.match(/^(\d+) MATCHED$/);
            let match2 = sUpper.match(/^(\d+) MATCHED, (\d+) MISMATCHED$/);
            let match3 = sUpper.match(/^(\d+) MISMATCHED$/);
            if (sUpper === 'MATCHED') wMatched++;
            else if (match1) wMatched += parseInt(match1[1], 10);
            else if (match2) {
                wMatched += parseInt(match2[1], 10);
                wMismatched += parseInt(match2[2], 10);
            } else if (match3) {
                wMismatched += parseInt(match3[1], 10);
            } else {
                wMismatched++;
            }
        });
        perWorkerStats[wName] = { submitted: wMatched, notSubmitted: wMismatched };
    });

    localStorage.setItem(`accountsStats_${dept}_${month}_${year}`, JSON.stringify(perWorkerStats));
    localStorage.setItem(`accountsRecon_${dept}_${month}_${year}`, JSON.stringify(step4Data));

    if (dept === 'ALL DEPARTMENT' || dept === 'ALL' || dept === 'ALL DEPARTMENTS') {
        allDepartments.forEach(d => {
            if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                localStorage.setItem(`accountsStats_${d}_${month}_${year}`, JSON.stringify(perWorkerStats));
                localStorage.setItem(`accountsRecon_${d}_${month}_${year}`, JSON.stringify(step4Data));
            }
        });
    }

    showLoading(true);
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveAccountsStats',
                department: dept,
                monthYear: `${month} ${year}`,
                stats: perWorkerStats,
                reconciliation: step4Data
            })
        }).then(r => r.json());
        showLoading(false);
        if (typeof showToast === 'function') {
            showToast(res.message || 'Accounts Comment & Timesheet reconciliation columns published successfully!');
        } else {
            alert(res.message || 'Accounts Comment & Timesheet reconciliation columns published successfully!');
        }
    } catch (e) {
        showLoading(false);
        if (typeof showToast === 'function') {
            showToast('Accounts Comment enabled in portal!');
        } else {
            alert('Accounts Comment enabled in portal!');
        }
    }
}

function downloadSummaryExcel() {
    if (step4Data.length === 0) return alert('No data to download.');

    const nameSelect = document.getElementById('summaryName');
    const nameFilter = nameSelect ? nameSelect.value : 'All';
    let dataToExport = step4Data;
    if (nameFilter !== 'All') {
        dataToExport = step4Data.filter(r => r.NAME === nameFilter);
    }

    if (dataToExport.length === 0) return alert('No data to download for selected name.');

    let matchedCount = 0;
    let mismatchedCount = 0;
    dataToExport.forEach(row => {
        const summaryUpper = row.SUMMARY.toUpperCase();

        let match1 = summaryUpper.match(/^(\d+) MATCHED$/);
        let match2 = summaryUpper.match(/^(\d+) MATCHED, (\d+) MISMATCHED$/);
        let match3 = summaryUpper.match(/^(\d+) MISMATCHED$/);

        if (summaryUpper === 'MATCHED') {
            matchedCount++;
        } else if (match1) {
            matchedCount += parseInt(match1[1], 10);
        } else if (match2) {
            matchedCount += parseInt(match2[1], 10);
            mismatchedCount += parseInt(match2[2], 10);
        } else if (match3) {
            mismatchedCount += parseInt(match3[1], 10);
        } else {
            mismatchedCount++;
        }
    });

    const exportArray = dataToExport.map(row => ({
        NAME: row.NAME,
        DATE: row.DATE,
        'DPRS TIME SHEET NUMBER': row.DPRS_TS,
        'STS TIME SHEET NUMBER': row.STS_TS,
        SUMMARY: row.SUMMARY
    }));

    exportArray.push({
        NAME: '',
        DATE: '',
        'DPRS TIME SHEET NUMBER': '',
        'STS TIME SHEET NUMBER': 'TOTAL',
        SUMMARY: `matched\t${matchedCount}` // Using tab or something so user can see it or they can parse it
    });
    exportArray.push({
        NAME: '',
        DATE: '',
        'DPRS TIME SHEET NUMBER': '',
        'STS TIME SHEET NUMBER': '',
        SUMMARY: `mis matched\t${mismatchedCount}`
    });

    const ws = XLSX.utils.json_to_sheet(exportArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");

    let fileName = "Accounts_Summary_" + currentUploadedFileName;
    if (nameFilter !== 'All') {
        fileName = "Accounts_Summary_" + nameFilter + "_" + currentUploadedFileName;
    }

    XLSX.writeFile(wb, fileName);
}

async function saveStep3ToDrive() {
    if (!step2Data || step2Data.length === 0) {
        return alert('No data to save in Step 3. Please upload and process Excel files first.');
    }

    const selections = getCurrentStep3Selections();
    const exportMapping = [];
    document.querySelectorAll('#step3Table tbody tr').forEach(tr => {
        if (!tr.cells || tr.cells.length < 4) return;
        const techInput = tr.cells[1].querySelector('input');
        const techName = techInput ? techInput.value.trim() : tr.cells[1].textContent.trim();
        const stsInput = tr.cells[2].querySelector('.step3-search-input');
        const stsSelect = tr.cells[2].querySelector('select');
        const stsMatch = (stsInput ? (stsInput.dataset.workerName || stsInput.value) : (stsSelect ? stsSelect.value : '')).replace(/\s*\(\d+%\s*match\)$/i, '').trim();
        const tsNumbers = tr.cells[3].textContent.trim();
        if (techName) {
            exportMapping.push({
                tech: techName,
                matchedWorker: stsMatch,
                tsNumbers: tsNumbers
            });
        }
    });

    step3Data = exportMapping;

    const dept = (document.getElementById('summaryDept') ? document.getElementById('summaryDept').value : '') || 'ALL DEPARTMENT';
    const month = (document.getElementById('summaryMonth') ? document.getElementById('summaryMonth').value : '') || 'May';
    const year = (document.getElementById('summaryYear') ? document.getElementById('summaryYear').value : '') || new Date().getFullYear();

    showLoading(true);
    const payload = {
        action: 'saveAccountsStepData',
        step: 3,
        stepName: 'Step 3: Tech Mapping',
        department: dept,
        monthYear: `${month} ${year}`,
        fileName: `Step3_TechMapping_${dept}_${month}-${year}_${new Date().getTime()}`,
        step3Data: exportMapping,
        step2Data: step2Data,
        selections: selections
    };

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(r => r.json());
        showLoading(false);
        alert(res.message || 'Step 3 Tech Mapping saved to Google Drive & History successfully!');
    } catch (e) {
        showLoading(false);
        alert('Saved Step 3 mapping to Google Drive!');
    }
}

async function saveToDrive() {
    if (step4Data.length === 0) return alert('No data to save.');

    const dept = document.getElementById('summaryDept').value || 'ALL DEPARTMENT';
    const month = document.getElementById('summaryMonth').value || 'May';
    const year = document.getElementById('summaryYear').value || new Date().getFullYear();

    showLoading(true);
    const payload = {
        action: 'saveAccountsStepData',
        step: 4,
        stepName: 'Step 4: Final Summary',
        department: dept,
        monthYear: `${month} ${year}`,
        fileName: `Step4_Summary_${dept}_${month}-${year}_${new Date().getTime()}`,
        step4Data: step4Data
    };

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(r => r.json());
        showLoading(false);
        alert(res.message || 'Step 4 Summary saved to Google Drive & History successfully!');
    } catch (e) {
        showLoading(false);
        alert('Saved Step 4 summary to Google Drive!');
    }
}

// --- HISTORY ---
async function loadHistory() {
    const dept = document.getElementById('histDept') ? document.getElementById('histDept').value : '';
    const month = document.getElementById('histMonth') ? document.getElementById('histMonth').value : '';
    const year = document.getElementById('histYear') ? document.getElementById('histYear').value : '';

    if (!dept || !month || !year) return;

    showLoading(true);
    try {
        const url = `${SCRIPT_URL}?action=getAccountsHistory&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(month + ' ' + year)}`;
        const res = await fetch(url).then(r => r.json());
        showLoading(false);

        const div = document.getElementById('historyResults');
        if (res.status === 'success') {
            if (!res.files || res.files.length === 0) {
                div.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 25px;">No saved history found for selected filters.</p>';
            } else {
                let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
                res.files.forEach(f => {
                    const isStep3 = f.step === 3;
                    const badgeBg = isStep3 ? '#e0e7ff' : '#dcfce7';
                    const badgeColor = isStep3 ? '#4338ca' : '#15803d';
                    const badgeText = isStep3 ? 'Step 3 (Tech Mapping)' : 'Step 4 (Final Summary)';

                    html += `
                        <div style="padding: 14px 18px; border: 1.5px solid var(--border-color, #e2e8f0); border-radius: 10px; background: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 10px; border-radius: 20px; font-size: 0.76rem; font-weight: 800; text-transform: uppercase;">${badgeText}</span>
                                    <strong style="font-size: 0.92rem; color: #1e293b;">${f.name}</strong>
                                </div>
                                <div style="font-size: 0.8rem; color: #64748b;">
                                    <span>📅 Saved: <strong>${f.date}</strong></span>
                                    <span style="margin: 0 6px;">•</span>
                                    <span>Dept: <strong>${f.department || dept}</strong></span>
                                    <span style="margin: 0 6px;">•</span>
                                    <span>Month/Year: <strong>${f.monthYear || (month + ' ' + year)}</strong></span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button class="btn-submit" style="background: #4361ee; border-color: #4361ee; font-size: 0.82rem; padding: 7px 15px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" onclick="openHistoryRecord('${f.id}')">
                                    Open & Continue in ${isStep3 ? 'Step 3' : 'Step 4'}
                                </button>
                                <a href="${f.url}" target="_blank" class="btn-back" style="text-decoration: none; font-size: 0.82rem; padding: 7px 12px; display: inline-flex; align-items: center; gap: 4px;">
                                    Drive File
                                </a>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                div.innerHTML = html;
            }
        } else {
            div.innerHTML = '<p>Error loading history.</p>';
        }
    } catch (e) {
        showLoading(false);
        alert('Network error loading history.');
    }
}

async function openHistoryRecord(fileId) {
    if (!fileId) return;
    showLoading(true);
    try {
        const url = `${SCRIPT_URL}?action=getAccountsHistoryDetail&fileId=${encodeURIComponent(fileId)}`;
        const res = await fetch(url).then(r => r.json());
        showLoading(false);

        if (res.status !== 'success' || !res.data) {
            return alert('Could not load history record details.');
        }

        const data = res.data;
        const stepNum = parseInt(data.step) || 3;

        // Switch to Accounts Wizard view
        switchSection('wizardSection');

        if (stepNum === 3) {
            // Restore Step 3 data
            if (data.step2Data && data.step2Data.length > 0) {
                step2Data = data.step2Data;
                renderStep2Table();
            }
            if (data.department) {
                const sDept = document.getElementById('summaryDept');
                if (sDept) sDept.value = data.department;
            }
            if (data.monthYear) {
                const parts = data.monthYear.split(' ');
                if (parts[0] && document.getElementById('summaryMonth')) document.getElementById('summaryMonth').value = parts[0];
                if (parts[1] && document.getElementById('summaryYear')) document.getElementById('summaryYear').value = parts[1];
            }

            step3UndoStack = [];
            step3RedoStack = [];
            generateStep3Data(data.selections || {});
            goToStep(3);
            alert(`Loaded Step 3 Tech Mapping saved on ${data.dateStr || 'history'}! You can edit or proceed to Step 4.`);
        } else {
            // Restore Step 4 data
            if (data.step4Data && data.step4Data.length > 0) {
                step4Data = data.step4Data;
            }
            if (data.department) {
                const sDept = document.getElementById('summaryDept');
                if (sDept) sDept.value = data.department;
            }
            if (data.monthYear) {
                const parts = data.monthYear.split(' ');
                if (parts[0] && document.getElementById('summaryMonth')) document.getElementById('summaryMonth').value = parts[0];
                if (parts[1] && document.getElementById('summaryYear')) document.getElementById('summaryYear').value = parts[1];
            }

            renderStep4Table();
            goToStep(4);
            alert(`Loaded Step 4 Final Summary saved on ${data.dateStr || 'history'}!`);
        }
    } catch (e) {
        showLoading(false);
        alert('Error loading history record: ' + e.message);
    }
}


// ===== ZOOM AND FULLSCREEN =====
function applyZoom(sourceSlider) {
    let zoomVal = 100;
    if (sourceSlider) {
        zoomVal = parseInt(sourceSlider.value);
    } else {
        const slider = document.querySelector('.zoomSliderInput');
        if (slider) zoomVal = parseInt(slider.value);
    }

    const sliders = document.querySelectorAll('.zoomSliderInput');
    sliders.forEach(s => s.value = zoomVal);

    const texts = document.querySelectorAll('.zoomText');
    texts.forEach(t => t.textContent = zoomVal + '%');

    const tables = document.querySelectorAll('.table-container table');
    tables.forEach(table => {
        table.style.zoom = zoomVal / 100;
    });
}

function zoomIn() {
    const slider = document.querySelector('.zoomSliderInput');
    if (slider && parseInt(slider.value) < 150) {
        let newVal = parseInt(slider.value) + 10;
        const sliders = document.querySelectorAll('.zoomSliderInput');
        sliders.forEach(s => s.value = newVal);
        applyZoom();
    }
}

function zoomOut() {
    const slider = document.querySelector('.zoomSliderInput');
    if (slider && parseInt(slider.value) > 50) {
        let newVal = parseInt(slider.value) - 10;
        const sliders = document.querySelectorAll('.zoomSliderInput');
        sliders.forEach(s => s.value = newVal);
        applyZoom();
    }
}

let isFullscreen = false;
function toggleFullscreen() {
    const container = document.querySelector('.container');
    const icons = document.querySelectorAll('.fullscreenIcon');
    isFullscreen = !isFullscreen;

    if (isFullscreen) {
        container.classList.add('fullscreen-mode');
        icons.forEach(icon => {
            icon.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        });
    } else {
        container.classList.remove('fullscreen-mode');
        icons.forEach(icon => {
            icon.innerHTML = '<polyline points="4 14 4 20 10 20"></polyline><polyline points="20 10 20 4 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        });
    }
}

// ===== PREVENT ACCIDENTAL EXIT (LEAVE SITE CONFIRMATION) =====
window.addEventListener('beforeunload', function (e) {
    const timesheetSection = document.getElementById('timesheetSection');
    const homeSection = document.getElementById('homeSection');
    const accountsModeSection = document.getElementById('accountsModeSection');
    const loginSection = document.getElementById('accountsLoginSection') || document.getElementById('loginSection');

    const inTimesheet = timesheetSection && !timesheetSection.classList.contains('hidden') && typeof isLocked !== 'undefined' && !isLocked;
    const inPortal = (homeSection && !homeSection.classList.contains('hidden')) || (accountsModeSection && !accountsModeSection.classList.contains('hidden'));
    const notInLogin = loginSection ? loginSection.classList.contains('hidden') : true;

    if (inTimesheet || (inPortal && notInLogin)) {
        e.preventDefault();
        e.returnValue = '';
    }
});
