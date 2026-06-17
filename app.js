// ===== CONFIGURATION =====
// IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyAfDeE-dM6fRXXH3VkKti6Qux2aO-E4oYroaoyMgNiRNXEuJhg7PcobO7NfGhnohItw/exec';

// ===== STATE =====
let currentWorker = '';
let currentMonth = '';
let currentYear = '';
let currentDepartment = '';
let currentData = [];
let daysInMonth = 0;
let entryMode = 'month'; // 'day' or 'month'

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    populateYearDropdown();
    setDefaultMonthYear();
    updateClock();
    setInterval(updateClock, 60000); // Update every minute
});

function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const clockEl = document.getElementById('currentDateTime');
    if (clockEl) clockEl.textContent = now.toLocaleDateString('en-US', options);
}

function populateYearDropdown() {
    const yearSelect = document.getElementById('yearSelect');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
    }
}

function setDefaultMonthYear() {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('monthSelect').value = months[now.getMonth()];
    document.getElementById('yearSelect').value = now.getFullYear();
    document.getElementById('dateSelect').valueAsDate = now;
}

function setEntryMode(mode) {
    entryMode = mode;
    const btnDay = document.getElementById('btnModeDay');
    const btnMonth = document.getElementById('btnModeMonth');
    const dateGroup = document.getElementById('dateGroup');
    const monthGroup = document.getElementById('monthGroup');
    const yearGroup = document.getElementById('yearGroup');

    if (mode === 'day') {
        btnDay.classList.add('active');
        btnMonth.classList.remove('active');
        dateGroup.style.display = 'flex';
        monthGroup.style.display = 'none';
        yearGroup.style.display = 'none';
    } else {
        btnDay.classList.remove('active');
        btnMonth.classList.add('active');
        dateGroup.style.display = 'none';
        monthGroup.style.display = 'flex';
        yearGroup.style.display = 'flex';
    }
}

// ===== HELPERS =====
function getDaysInMonth(month, year) {
    const monthIndex = getMonthIndex(month);
    return new Date(year, monthIndex + 1, 0).getDate();
}

function getDayName(date) {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[date.getDay()];
}

function getMonthIndex(month) {
    return [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(month);
}

function formatDate(day, month, year) {
    const d = String(day).padStart(2, '0');
    const m = String(getMonthIndex(month) + 1).padStart(2, '0');
    return `${d}/${m}/${year}`;
}

function showLoading(text) {
    document.getElementById('loadingText').textContent = text || 'Loading...';
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    toast.className = `toast ${type}`;

    if (type === 'success') toastIcon.textContent = '✓';
    else if (type === 'error') toastIcon.textContent = '✗';
    else toastIcon.textContent = 'ℹ';

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ===== ZOOM CONTROLS =====
let currentZoom = 100; // percentage

function zoomIn() {
    if (currentZoom < 200) {
        currentZoom += 10;
        applyZoom();
    }
}

function zoomOut() {
    if (currentZoom > 50) {
        currentZoom -= 10;
        applyZoom();
    }
}

function applyZoom() {
    const table = document.getElementById('spreadsheetTable');
    if (table) {
        const scale = currentZoom / 100;
        table.style.transform = `scale(${scale})`;
        // Adjust container width to prevent clipping
        const container = document.getElementById('spreadsheetContainer');
        if (container) {
            container.style.width = scale > 1 ? `${100 / scale}%` : '100%';
        }
    }
    document.getElementById('zoomLevel').textContent = `${currentZoom}%`;
}

// Ctrl + / Ctrl - keyboard zoom
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
    } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomOut();
    } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        currentZoom = 100;
        applyZoom();
    }
});

// ===== FULLSCREEN =====
let isFullscreen = false;

function toggleFullscreen() {
    const section = document.getElementById('timesheetSection');
    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');
    const icon = document.getElementById('fullscreenIcon');

    isFullscreen = !isFullscreen;

    if (isFullscreen) {
        section.classList.add('fullscreen-mode');
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';
        // Change icon to minimize
        icon.innerHTML = `
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        `;
    } else {
        section.classList.remove('fullscreen-mode');
        if (header) header.style.display = '';
        if (footer) footer.style.display = '';
        // Change icon to maximize
        icon.innerHTML = `
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        `;
    }
}

// F11 for fullscreen
document.addEventListener('keydown', function (e) {
    if (e.key === 'F11') {
        e.preventDefault();
        const section = document.getElementById('timesheetSection');
        if (section && !section.classList.contains('hidden')) {
            toggleFullscreen();
        }
    }
});

// Editable column indices (skip readonly columns 0-3: #, Name, Date, Day)
const EDITABLE_COL_INDICES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// ===== KEYBOARD NAVIGATION =====
// Arrow Up/Down: move between rows in the same column
// Arrow Left/Right: move to the previous/next column on the same row
// Enter: move down one row; if last row, jump to row 1 of the next column
// Tab: move to the next editable cell (browser default)
document.addEventListener('keydown', function (e) {
    const active = document.activeElement;
    if (!active || !active.closest('.spreadsheet tbody')) return;

    const td = active.closest('td');
    if (!td) return;

    const tr = td.parentElement;
    const tbody = tr.parentElement;
    if (tbody.tagName !== 'TBODY') return;

    const cellIndex = Array.from(tr.children).indexOf(td);
    const rowIndex = Array.from(tbody.children).indexOf(tr);
    const totalRows = tbody.children.length;
    const currentEditIdx = EDITABLE_COL_INDICES.indexOf(cellIndex);

    let targetRow, targetCell, targetInput;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Move down one row, same column
        targetRow = tbody.children[rowIndex + 1];
        if (targetRow) {
            targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
            if (targetInput) {
                targetInput.focus();
                targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Move up one row, same column
        targetRow = tbody.children[rowIndex - 1];
        if (targetRow) {
            targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
            if (targetInput) {
                targetInput.focus();
                targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
        }
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Move to the next editable column, same row
        if (currentEditIdx >= 0 && currentEditIdx < EDITABLE_COL_INDICES.length - 1) {
            const nextCol = EDITABLE_COL_INDICES[currentEditIdx + 1];
            targetInput = tr.children[nextCol]?.querySelector('input, select');
            if (targetInput) {
                targetInput.focus();
                targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            }
        }
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Move to the previous editable column, same row
        if (currentEditIdx > 0) {
            const prevCol = EDITABLE_COL_INDICES[currentEditIdx - 1];
            targetInput = tr.children[prevCol]?.querySelector('input, select');
            if (targetInput) {
                targetInput.focus();
                targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            }
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            // Shift+Enter: move up
            targetRow = tbody.children[rowIndex - 1];
            if (targetRow) {
                targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
                if (targetInput) {
                    targetInput.focus();
                    targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                }
            }
        } else {
            // Enter: move down; if last row, wrap to row 1 of next column
            if (rowIndex < totalRows - 1) {
                targetRow = tbody.children[rowIndex + 1];
                targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
                if (targetInput) {
                    targetInput.focus();
                    targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                }
            } else if (currentEditIdx >= 0 && currentEditIdx < EDITABLE_COL_INDICES.length - 1) {
                // Last row reached — jump to row 1 of the next column
                const nextCol = EDITABLE_COL_INDICES[currentEditIdx + 1];
                targetRow = tbody.children[0];
                targetInput = targetRow.children[nextCol]?.querySelector('input, select');
                if (targetInput) {
                    targetInput.focus();
                    targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                }
            }
        }
    } else if (e.key === 'Tab') {
        // Excel-like Tab behavior: Move right, wrap to next row's first editable cell
        if (!e.shiftKey) {
            if (currentEditIdx === EDITABLE_COL_INDICES.length - 1) {
                e.preventDefault();
                targetRow = tbody.children[rowIndex + 1];
                if (targetRow) {
                    const firstCol = EDITABLE_COL_INDICES[0];
                    targetInput = targetRow.children[firstCol]?.querySelector('input, select');
                    if (targetInput) {
                        targetInput.focus();
                        targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                    }
                }
            }
        } else {
            // Shift + Tab: Move left, wrap to previous row's last editable cell
            if (currentEditIdx === 0) {
                e.preventDefault();
                targetRow = tbody.children[rowIndex - 1];
                if (targetRow) {
                    const lastCol = EDITABLE_COL_INDICES[EDITABLE_COL_INDICES.length - 1];
                    targetInput = targetRow.children[lastCol]?.querySelector('input, select');
                    if (targetInput) {
                        targetInput.focus();
                        targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
                    }
                }
            }
        }
    }
});

function loadTimesheet() {
    const department = document.getElementById('departmentSelect').value;
    const name = document.getElementById('workerName').value.trim();
    const month = document.getElementById('monthSelect').value;
    const year = document.getElementById('yearSelect').value;

    if (!department) {
        showToast('Please select a department', 'error');
        document.getElementById('departmentSelect').focus();
        return;
    }
    if (!name) {
        showToast('Please enter worker name', 'error');
        document.getElementById('workerName').focus();
        return;
    }
    if (entryMode === 'day') {
        const dateVal = document.getElementById('dateSelect').value;
        if (!dateVal) {
            showToast('Please select a date', 'error');
            return;
        }
        const selectedDate = new Date(dateVal);
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        currentMonth = months[selectedDate.getMonth()];
        currentYear = selectedDate.getFullYear().toString();
        currentWorker = name;
        currentDepartment = department;
    } else {
        if (!month) {
            showToast('Please select a month', 'error');
            return;
        }
        if (!year) {
            showToast('Please select a year', 'error');
            return;
        }
        currentDepartment = department;
        currentWorker = name;
        currentMonth = month;
        currentYear = year;
    }

    daysInMonth = getDaysInMonth(currentMonth, currentYear);

    showLoading('Loading timesheet data...');

    // Try to fetch existing data from Google Sheets
    fetchExistingData(department, name, month, year)
        .then(existingData => {
            buildSpreadsheet(existingData);
            hideLoading();

            // Show timesheet, hide selection
            document.getElementById('homeSection').style.display = 'none';
            document.getElementById('timesheetSection').classList.remove('hidden');
            document.getElementById('timesheetTitle').textContent = `${name}'s Timesheet`;
            document.getElementById('timesheetSubtitle').textContent = `${department} · ${month} ${year} · ${daysInMonth} days`;

            if (existingData && existingData.length > 0) {
                showToast('Existing data loaded successfully!', 'info');
            } else {
                showToast('New timesheet created!', 'success');
            }
        })
        .catch(err => {
            console.error('Error fetching data:', err);
            buildSpreadsheet(null);
            hideLoading();

            document.getElementById('homeSection').style.display = 'none';
            document.getElementById('timesheetSection').classList.remove('hidden');
            document.getElementById('timesheetTitle').textContent = `${name}'s Timesheet`;
            document.getElementById('timesheetSubtitle').textContent = `${department} · ${month} ${year} · ${daysInMonth} days`;

            showToast('Created new timesheet (offline mode)', 'info');
        });
}

async function fetchExistingData(department, name, month, year) {
    if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        return null;
    }

    const sheetName = `${name}-${month}-${year}`;
    const url = `${SCRIPT_URL}?action=getData&department=${encodeURIComponent(department)}&monthYear=${encodeURIComponent(month + ' ' + year)}&sheetName=${encodeURIComponent(sheetName)}`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.status === 'success' && result.data && result.data.length > 0) {
        return result.data;
    }
    return null;
}

// ===== BUILD SPREADSHEET =====
function buildSpreadsheet(existingData) {
    const tbody = document.getElementById('spreadsheetBody');
    const tfoot = document.getElementById('spreadsheetFoot');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const monthIndex = getMonthIndex(currentMonth);

    let highlightedInput = null;
    const selectedDateVal = entryMode === 'day' ? document.getElementById('dateSelect').value : null;
    const selectedDayOfMonth = selectedDateVal ? new Date(selectedDateVal).getDate() : null;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, monthIndex, day);
        const dayName = getDayName(date);
        const dateStr = formatDate(day, currentMonth, currentYear);
        const isSunday = date.getDay() === 0;
        const isSaturday = date.getDay() === 6;
        const isSelectedDay = day === selectedDayOfMonth;

        const tr = document.createElement('tr');
        if (isSunday) tr.classList.add('row-sunday');
        else if (isSaturday) tr.classList.add('row-saturday');
        if (isSelectedDay) tr.classList.add('row-highlight');

        // Check for existing data for this row
        let rowData = null;
        if (existingData) {
            rowData = existingData.find(d => d.date === dateStr);
        }

        tr.innerHTML = `
            <td><div class="cell-readonly cell-sno">${day}</div></td>
            <td><div class="cell-readonly cell-name">${currentWorker}</div></td>
            <td><div class="cell-readonly cell-date">${dateStr}</div></td>
            <td><div class="cell-readonly cell-day ${isSunday ? 'sunday' : isSaturday ? 'saturday' : 'weekday'}">${dayName}</div></td>
            <td><input type="time" id="dayShiftIn_${day}" data-row="${day}" data-col="dayShiftIn" value="${rowData ? rowData.dayShiftIn || '' : ''}"></td>
            <td><input type="time" id="dayShiftOut_${day}" data-row="${day}" data-col="dayShiftOut" value="${rowData ? rowData.dayShiftOut || '' : ''}"></td>
            <td><input type="time" id="clientIn_${day}" data-row="${day}" data-col="clientIn" value="${rowData ? rowData.clientIn || '' : ''}"></td>
            <td><input type="time" id="clientOut_${day}" data-row="${day}" data-col="clientOut" value="${rowData ? rowData.clientOut || '' : ''}"></td>
            <td><input type="text" id="siteLoc1_${day}" data-row="${day}" data-col="siteLoc1" value="${rowData ? rowData.siteLoc1 || '' : ''}"></td>
            <td><input type="text" id="siteLoc2_${day}" data-row="${day}" data-col="siteLoc2" value="${rowData ? rowData.siteLoc2 || '' : ''}"></td>
            <td><input type="number" id="otHrs_${day}" data-row="${day}" data-col="otHrs" step="0.5" min="0" value="${rowData ? rowData.otHrs || '' : ''}" oninput="updateTotals()"></td>
            <td><input type="number" id="siteAllowanceHrs_${day}" data-row="${day}" data-col="siteAllowanceHrs" step="0.5" min="0" value="${rowData ? rowData.siteAllowanceHrs || '' : ''}" oninput="updateTotals()"></td>
            <td><input type="number" id="travelAllowance_${day}" data-row="${day}" data-col="travelAllowance" step="0.01" min="0" value="${rowData ? rowData.travelAllowance || '' : ''}" oninput="updateTotals()"></td>
            <td><input type="number" id="otherAllowance_${day}" data-row="${day}" data-col="otherAllowance" step="0.01" min="0" value="${rowData ? rowData.otherAllowance || '' : ''}" oninput="updateTotals()"></td>
            <td><input type="number" id="busAllowance_${day}" data-row="${day}" data-col="busAllowance" step="0.01" min="0" value="${rowData ? rowData.busAllowance || '' : ''}" oninput="updateTotals()"></td>
            <td><input type="text" id="remarks_${day}" data-row="${day}" data-col="remarks" value="${rowData ? rowData.remarks || '' : ''}"></td>
        `;

        tbody.appendChild(tr);

        if (isSelectedDay) {
            highlightedInput = tr.querySelector('input');
        }
    }

    buildTotalsRow();
    updateTotals();

    // Auto-focus the highlighted day's first input
    if (highlightedInput) {
        setTimeout(() => {
            highlightedInput.focus();
            highlightedInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

function buildTotalsRow() {
    const tfoot = document.getElementById('spreadsheetFoot');
    tfoot.innerHTML = `
        <tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td colspan="4" class="total-label">TOTAL</td>
            <td></td>
            <td></td>
            <td class="total-value" id="totalOtHrs">0</td>
            <td class="total-value" id="totalSiteAllowanceHrs">0</td>
            <td class="total-money" id="totalTravelAllowance">$0.00</td>
            <td class="total-money" id="totalOtherAllowance">$0.00</td>
            <td class="total-money" id="totalBusAllowance">$0.00</td>
            <td class="total-label" id="totalTimesheets" style="font-size:0.7rem;"></td>
        </tr>
    `;
}

function updateTotals() {
    let totalOt = 0;
    let totalSiteAllow = 0;
    let totalTravel = 0;
    let totalOther = 0;
    let totalBus = 0;
    let timesheetCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const ot = parseFloat(document.getElementById(`otHrs_${day}`)?.value) || 0;
        const sa = parseFloat(document.getElementById(`siteAllowanceHrs_${day}`)?.value) || 0;
        const ta = parseFloat(document.getElementById(`travelAllowance_${day}`)?.value) || 0;
        const oa = parseFloat(document.getElementById(`otherAllowance_${day}`)?.value) || 0;
        const ba = parseFloat(document.getElementById(`busAllowance_${day}`)?.value) || 0;

        totalOt += ot;
        totalSiteAllow += sa;
        totalTravel += ta;
        totalOther += oa;
        totalBus += ba;

        const clientIn = document.getElementById(`clientIn_${day}`)?.value || '';
        const clientOut = document.getElementById(`clientOut_${day}`)?.value || '';
        if (clientIn || clientOut) {
            timesheetCount++;
        }
    }

    document.getElementById('totalOtHrs').textContent = totalOt % 1 === 0 ? totalOt : totalOt.toFixed(1);
    document.getElementById('totalSiteAllowanceHrs').textContent = totalSiteAllow % 1 === 0 ? totalSiteAllow : totalSiteAllow.toFixed(1);
    document.getElementById('totalTravelAllowance').textContent = `$${totalTravel.toFixed(2)}`;
    document.getElementById('totalOtherAllowance').textContent = `$${totalOther.toFixed(2)}`;
    document.getElementById('totalBusAllowance').textContent = `$${totalBus.toFixed(2)}`;
    document.getElementById('totalTimesheets').innerHTML = `TOTAL CLIENT<br>TIMESHEETS<br>COLLECTED : ${timesheetCount}`;
}

// ===== SUBMIT TIMESHEET =====
async function submitTimesheet() {
    if (SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' || !SCRIPT_URL) {
        showToast('Please configure Google Apps Script URL first!', 'error');
        return;
    }

    showLoading('Submitting and saving data...');

    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDate(day, currentMonth, currentYear);
        const date = new Date(currentYear, getMonthIndex(currentMonth), day);
        const dayName = getDayName(date);

        rows.push({
            name: currentWorker,
            date: dateStr,
            day: dayName,
            dayShiftIn: document.getElementById(`dayShiftIn_${day}`).value || '',
            dayShiftOut: document.getElementById(`dayShiftOut_${day}`).value || '',
            clientIn: document.getElementById(`clientIn_${day}`).value || '',
            clientOut: document.getElementById(`clientOut_${day}`).value || '',
            siteLoc1: document.getElementById(`siteLoc1_${day}`).value || '',
            siteLoc2: document.getElementById(`siteLoc2_${day}`).value || '',
            otHrs: document.getElementById(`otHrs_${day}`).value || '',
            siteAllowanceHrs: document.getElementById(`siteAllowanceHrs_${day}`).value || '',
            travelAllowance: document.getElementById(`travelAllowance_${day}`).value || '',
            otherAllowance: document.getElementById(`otherAllowance_${day}`).value || '',
            busAllowance: document.getElementById(`busAllowance_${day}`).value || '',
            remarks: document.getElementById(`remarks_${day}`).value || ''
        });
    }

    // Calculate totals from UI values (to ensure accuracy with what's visible)
    const payload = {
        action: 'saveData',
        department: currentDepartment,
        monthYear: `${currentMonth} ${currentYear}`,
        sheetName: `${currentWorker}-${currentMonth}-${currentYear}`,
        workerName: currentWorker,
        month: currentMonth,
        year: currentYear,
        rows: rows,
        totals: {
            otHrs: parseFloat(document.getElementById('totalOtHrs').textContent) || 0,
            siteAllowanceHrs: parseFloat(document.getElementById('totalSiteAllowanceHrs').textContent) || 0,
            travelAllowance: parseFloat(document.getElementById('totalTravelAllowance').textContent.replace('$', '')) || 0,
            otherAllowance: parseFloat(document.getElementById('totalOtherAllowance').textContent.replace('$', '')) || 0,
            busAllowance: parseFloat(document.getElementById('totalBusAllowance').textContent.replace('$', '')) || 0,
            timesheetCount: parseInt(document.getElementById('totalTimesheets').textContent.split(': ')[1]) || 0
        }
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        hideLoading();
        showToast('Timesheet Updated Successfully!', 'success');
    } catch (error) {
        console.error('Submit error:', error);
        hideLoading();
        showToast('Error saving data. Please try again.', 'error');
    }
}

// ===== GO BACK =====
function goBack() {
    document.getElementById('timesheetSection').classList.add('hidden');
    document.getElementById('homeSection').style.display = 'block';
}


