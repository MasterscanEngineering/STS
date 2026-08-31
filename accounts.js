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
        select.innerHTML = '<option value="">Select Dept</option>';
        allDepartments.forEach(d => {
            if (d !== 'Admin ID' && !d.toLowerCase().includes('accounts')) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                select.appendChild(opt);
            }
        });
    });

    document.getElementById('summaryDept').onchange = function () {
        const dept = this.value;
        const nameSelect = document.getElementById('summaryName');
        nameSelect.innerHTML = '<option value="All">All Workers</option>';
        if (dept && masterList[dept]) {
            masterList[dept].forEach(w => {
                const workerName = w.name || w;
                const opt = document.createElement('option');
                opt.value = workerName;
                opt.textContent = workerName;
                nameSelect.appendChild(opt);
            });
        }
        renderStep4Table();
    };

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
function startNewUpload() { switchSection('wizardSection'); goToStep(1); }
function showHistory() { switchSection('historySection'); }

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
function proceedToStep3() { generateStep3Data(); goToStep(3); }
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

// --- STEP 3: MATCHING ---
function calculateMatch(str1, str2) {
    // Very basic distance or token match
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
        if (!uniqueTechs[row['TECH']]) {
            uniqueTechs[row['TECH']] = [];
        }
        uniqueTechs[row['TECH']].push(row['TIME SHEET NUMBER']);
    });

    // For each unique tech, find best match in masterWorkers
    const tbody = document.querySelector('#step3Table tbody');
    tbody.innerHTML = '';

    const allMasterNames = masterWorkers.map(w => w.name);

    Object.keys(uniqueTechs).forEach(techName => {
        // Calculate scores
        let scores = masterWorkers.map(mw => {
            return { name: mw.name, score: calculateMatch(techName, mw.name) };
        });

        // Sorting logic requested: Exact match (100) at BOTTOM, 50% middle, 1-50% top
        // Let's sort ascending by score, so lowest score is first (top) and highest score (exact) is last (bottom)
        scores.sort((a, b) => a.score - b.score);

        // Create row
        const tr = document.createElement('tr');

        const tdTech = document.createElement('td');
        const inputTech = document.createElement('input');
        inputTech.type = 'text';
        inputTech.className = 'form-control';
        inputTech.value = techName;
        inputTech.dataset.oldTech = techName;
        inputTech.onchange = handleTechNameEdit;
        tdTech.appendChild(inputTech);

        const tdSts = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'form-control';
        select.dataset.tech = techName;

        scores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = `${s.name} (${Math.round(s.score)}% match)`;
            select.appendChild(opt);
        });

        // Pre-select the best match (which is at the bottom of the options)
        if (preservedSelections[techName]) {
            select.value = preservedSelections[techName];
        } else if (scores.length > 0) {
            select.value = scores[scores.length - 1].name;
        }

        tdSts.appendChild(select);

        const tdTs = document.createElement('td');
        const tsNumbers = [...new Set(uniqueTechs[techName])].join(', ');
        tdTs.textContent = tsNumbers;

        tr.appendChild(tdTech);
        tr.appendChild(tdSts);
        tr.appendChild(tdTs);
        tbody.appendChild(tr);
    });
}

function handleTechNameEdit(e) {
    const input = e.target;
    const oldName = input.dataset.oldTech;
    const newName = input.value.trim();

    if (!newName || newName === oldName) {
        input.value = oldName;
        return;
    }

    // Save current selections
    const currentSelections = {};
    document.querySelectorAll('#step3Table select').forEach(sel => {
        currentSelections[sel.dataset.tech] = sel.value;
    });

    // Update step2Data
    step2Data.forEach(row => {
        const currentTech = row['TECH'] ? row['TECH'].trim() : '';
        if (currentTech === oldName) {
            row['TECH'] = newName;
        }
    });

    // Transfer selection to new name if it existed
    if (currentSelections[oldName]) {
        currentSelections[newName] = currentSelections[oldName];
        delete currentSelections[oldName];
    }

    // Re-render
    generateStep3Data(currentSelections);
}

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
    const allDeptWorkers = masterList[dept] ? masterList[dept].map(w => w.name || w) : [];
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
                throw new Error('Google Apps Script rate limit reached or service unavailable. Please try again later.');
            }
            
            if (result.status === 'success' && result.data) {
                result.data.forEach(r => {
                    backendData.push({
                        name: r.name || r._workerName,
                        date: r.date,
                        tsNumber: r.tsNumber,
                        sheetType: r._sheetType || 'normal'
                    });
                });
            } else if (result.status === 'error') {
                throw new Error(result.message);
            }
        } catch (e) {
            console.error('Failed to fetch bulk data:', e);
            throw e; // Abort the comparison
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
        const techInput = tr.cells[0].querySelector('input');
        const techName = techInput ? techInput.value : tr.cells[0].textContent;
        const stsSelect = tr.cells[1].querySelector('select');
        const stsMatch = stsSelect ? stsSelect.value : '';
        const tsNumbers = tr.cells[2].textContent;
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

    showLoading(true);
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveAccountsStats',
                department: dept,
                monthYear: `${month} ${year}`,
                stats: perWorkerStats
            })
        }).then(r => r.json());
        showLoading(false);
        alert(res.message || 'Accounts Comment is now visible in the portal!');
    } catch (e) {
        showLoading(false);
        alert('Accounts Comment enabled in portal!');
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

async function saveToDrive() {
    if (step4Data.length === 0) return alert('No data to save.');

    const dept = document.getElementById('summaryDept').value;
    const month = document.getElementById('summaryMonth').value;
    const year = document.getElementById('summaryYear').value;

    showLoading(true);
    const payload = {
        action: 'saveAccountsSummary',
        department: dept,
        monthYear: `${month} ${year}`,
        fileName: `Summary_${currentUploadedFileName.replace('.xlsx', '')}_${new Date().getTime()}`,
        data: step4Data
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        alert('Saved to Google Drive Successfully!');
    } catch (e) {
        alert('Error saving data.');
    }
    showLoading(false);
}

// --- HISTORY ---
async function loadHistory() {
    const dept = document.getElementById('histDept').value;
    const month = document.getElementById('histMonth').value;
    const year = document.getElementById('histYear').value;

    if (!dept || !month || !year) return alert('Select filters.');

    showLoading(true);
    try {
        const url = `${SCRIPT_URL}?action=getAccountsHistory&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(month + ' ' + year)}`;
        const res = await fetch(url);
        const result = await res.json();

        const div = document.getElementById('historyResults');
        if (result.status === 'success') {
            if (result.files.length === 0) {
                div.innerHTML = '<p>No history found.</p>';
            } else {
                div.innerHTML = '<ul>' + result.files.map(f => `<li><a href="${f.url}" target="_blank">${f.name}</a></li>`).join('') + '</ul>';
            }
        } else {
            div.innerHTML = '<p>Error loading history.</p>';
        }
    } catch (e) {
        alert('Network error loading history.');
    }
    showLoading(false);
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
