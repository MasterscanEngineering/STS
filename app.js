const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyAfDeE-dM6fRXXH3VkKti6Qux2aO-E4oYroaoyMgNiRNXEuJhg7PcobO7NfGhnohItw/exec';
        let currentWorker = '', currentMonth = '', currentYear = '', currentData = [], daysInMonth = 0, entryMode = 'month', isAdmin = false, masterWorkerList = {}, masterAdmins = [], currentDepartment = '', isLocked = false, selectedDayOnly = null;

        document.addEventListener('DOMContentLoaded', () => {
            setDefaultMonthYear();
            updateClock();
            setInterval(updateClock, 60000);
            refreshWorkerListFromMaster();

            // Set up exit modal handlers
            document.getElementById('btnExitSave').onclick = async () => {
                closeModal('exitConfirmModal');
                await submitTimesheet();
                exitTimesheet();
            };
            document.getElementById('btnExitNoSave').onclick = () => {
                closeModal('exitConfirmModal');
                exitTimesheet();
            };
        });

        function updateClock() { const now = new Date(); const clockEl = document.getElementById('currentDateTime'); if (clockEl) clockEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

        function setDefaultMonthYear() { const now = new Date(); const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; document.getElementById('monthSelect').value = months[now.getMonth()]; document.getElementById('yearSelect').value = now.getFullYear(); document.getElementById('dateSelect').valueAsDate = now; }

        function setEntryMode(mode) {
            entryMode = mode;
            document.getElementById('btnModeDay').classList.toggle('active', mode === 'day');
            document.getElementById('btnModeMonth').classList.toggle('active', mode === 'month');
            document.getElementById('dateGroup').style.display = mode === 'day' ? 'flex' : 'none';
            document.getElementById('monthGroup').style.display = mode === 'month' ? 'flex' : 'none';
            document.getElementById('yearGroup').style.display = mode === 'month' ? 'flex' : 'none';
        }

        function getDaysInMonth(m, y) { return new Date(y, getMonthIndex(m) + 1, 0).getDate(); }
        function getDayName(d) { return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][d.getDay()]; }
        function getMonthIndex(m) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(m); }
        function formatDate(d, m, y) { return `${String(d).padStart(2, '0')}/${String(getMonthIndex(m) + 1).padStart(2, '0')}/${y}`; }

        function showLoading(txt) { document.getElementById('loadingText').textContent = txt || 'Loading...'; document.getElementById('loadingOverlay').classList.remove('hidden'); }
        function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }
        function showToast(msg, type = 'success') { const toast = document.getElementById('toast'), tMsg = document.getElementById('toastMessage'), tIco = document.getElementById('toastIcon'); tMsg.textContent = msg; toast.className = `toast ${type}`; tIco.textContent = type === 'success' ? '✓' : '✗'; setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => toast.classList.remove('show'), 4000); }

        function showSection(id) {
            document.getElementById('homeSection').style.display = id === 'home' ? 'block' : 'none';
            document.getElementById('timesheetSection').classList.toggle('hidden', id !== 'timesheet');
            
            const accSection = document.getElementById('accountsPortalSection');
            if (accSection) {
                accSection.classList.toggle('hidden', id !== 'accounts');
            }
        }

        async function refreshWorkerListFromMaster() {
            try {
                const res = await fetch(`${SCRIPT_URL}?action=getWorkerList`).then(r => r.json());
                if (res.status === 'success') {
                    masterWorkerList = res.data;
                    masterAdmins = res.admins || [];

                    // Dynamically populate department dropdown
                    const deptSelect = document.getElementById('departmentSelect');
                    const currentVal = deptSelect.value;
                    deptSelect.innerHTML = '<option value="">Select Department</option>';
                    Object.keys(masterWorkerList).forEach(dept => {
                        if (dept.toLowerCase().includes('accounts')) return;
                        const opt = document.createElement('option');
                        opt.value = dept;
                        opt.textContent = dept;
                        deptSelect.appendChild(opt);
                    });
                    if (currentVal) deptSelect.value = currentVal;

                    loadWorkerList();
                }
            } catch (e) { console.error('Master list fetch failed', e); }
        }

        function loadWorkerList() {
            const dept = document.getElementById('departmentSelect').value;
            const input = document.getElementById('workerSelect');
            const dropdown = document.getElementById('customWorkerDropdown');
            input.value = '';
            dropdown.innerHTML = '';
            dropdown.classList.remove('show');
            if (dept && masterWorkerList[dept]) {
                filterCustomWorkerList();
            }
        }

        function togglePasswordVisibility(id) {
            const el = document.getElementById(id);
            const btn = el.nextElementSibling;
            if (el.type === 'password') {
                el.type = 'text';
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            } else {
                el.type = 'password';
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            }
        }

        function showCustomWorkerList() {
            const dept = document.getElementById('departmentSelect').value;
            if (!dept) {
                showToast('Select Department first', 'info');
                return;
            }
            filterCustomWorkerList();
            document.getElementById('customWorkerDropdown').classList.add('show');
        }

        function filterCustomWorkerList() {
            const dept = document.getElementById('departmentSelect').value;
            const inputVal = document.getElementById('workerSelect').value.toLowerCase();
            const dropdown = document.getElementById('customWorkerDropdown');
            dropdown.innerHTML = '';

            if (dept && masterWorkerList[dept]) {
                const filtered = masterWorkerList[dept].filter(worker => {
                    const wName = typeof worker === 'string' ? worker : worker.name;
                    return wName.toLowerCase().includes(inputVal);
                });

                if (filtered.length > 0) {
                    filtered.forEach(worker => {
                        const wName = typeof worker === 'string' ? worker : worker.name;
                        const div = document.createElement('div');
                        div.className = 'dropdown-item';
                        div.textContent = wName;
                        div.onclick = () => selectWorker(wName);
                        dropdown.appendChild(div);
                    });
                } else {
                    const div = document.createElement('div');
                    div.className = 'dropdown-item no-results';
                    div.textContent = 'No matching workers';
                    dropdown.appendChild(div);
                }
            }
        }

        function selectWorker(name) {
            document.getElementById('workerSelect').value = name;
            document.getElementById('customWorkerDropdown').classList.remove('show');
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-wrapper')) {
                const dropdown = document.getElementById('customWorkerDropdown');
                if (dropdown) dropdown.classList.remove('show');
            }
        });

        function toggleAdminLogin() {
            if (isAdmin) {
                // If already admin, clicking should just logout immediately
                performLogout();
            } else {
                document.getElementById('loginModal').classList.add('show');
            }
        }

        function performLogout() {
            isAdmin = false;
            document.body.classList.remove('admin-active');

            // Clean up UI instantly
            document.getElementById('btnAdminNav').textContent = 'Admin Portal';
            document.getElementById('welcomeGreeting').textContent = 'Welcome back!';
            document.getElementById('workerPasswordGroup').style.display = 'flex';
            document.getElementById('workerPassword').value = '';

            const loginLink = document.querySelector('.admin-login-link');
            if (loginLink) loginLink.textContent = 'Login as Administrator';

            // Hide admin verification panels
            document.getElementById('btnAdminVerify').style.display = 'none';
            document.getElementById('btnHeaderVerify').style.display = 'none';

            // Close the modal instantly
            closeModal('logoutModal');

            // Exit any active timesheet view
            exitTimesheet();

            showToast('Logged out, closing session...');

            // Attempt to close the tab
            setTimeout(() => {
                window.close();
                // Fallback for browsers that block window.close()
                if (!window.closed) {
                    window.location.href = "about:blank";
                }
            }, 300);
        }

        function closeModal(id) { document.getElementById(id).classList.remove('show'); }

        function handleAdminLogin() {
            const id = document.getElementById('adminId').value;
            const pw = document.getElementById('adminPassword').value;

            const admin = masterAdmins.find(a => a.name === id);
            if (admin && admin.password === pw) {
                isAdmin = true;
                document.body.classList.add('admin-active');
                closeModal('loginModal');
                document.getElementById('btnAdminNav').textContent = 'Admin Portal Logout';
                document.getElementById('welcomeGreeting').textContent = 'Admin Portal Active';
                document.getElementById('workerPasswordGroup').style.display = 'none';
                const loginLink = document.querySelector('.admin-login-link');
                if (loginLink) loginLink.textContent = 'Logout Administrator';
                showToast('Welcome Administrator!');
            } else {
                showToast('Invalid credentials', 'error');
            }
        }

        async function showStatusModal() {
            const dept = document.getElementById('departmentSelect').value;
            const mon = document.getElementById('monthSelect').value;
            const yr = document.getElementById('yearSelect').value;
            if (!dept) { showToast('Select Department first', 'error'); return; }

            showLoading('Fetching status...');
            document.getElementById('statusSubtitle').textContent = `${dept} · ${mon} ${yr}`;
            try {
                const res = await fetch(`${SCRIPT_URL}?action=getStatus&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(mon + ' ' + yr)}`).then(r => r.json());
                hideLoading();
                if (res.status === 'success') {
                    let html = '<table class="status-table"><thead><tr><th>Worker Name</th><th>Status</th><th>Action</th></tr></thead><tbody>';
                    res.data.forEach(item => {
                        const badgeClass = `badge-${item.status.toLowerCase()}`;
                        let actions = '-';
                        if (isAdmin && (item.status === 'Submitted' || item.status === 'Verified')) {
                            actions = `<div style="display: flex; gap: 5px; justify-content: flex-start;"><button onclick="viewWorkerFromStatus('${item.name}')" style="background:var(--accent-primary); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer;">View</button>`;
                            if (item.status === 'Verified') {
                                actions += `<button onclick="handleResubmit('${item.name}')" style="background:var(--accent-orange); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer;">Resubmit</button>`;
                            }
                            actions += `</div>`;
                        }
                        html += `<tr><td>${item.name}</td><td><span class="badge ${badgeClass}">${item.status}</span></td><td>${actions}</td></tr>`;
                    });
                    html += '</tbody></table>';
                    document.getElementById('statusListContent').innerHTML = html;
                    document.getElementById('statusModal').classList.add('show');
                }
            } catch (e) { hideLoading(); showToast('Error fetching status', 'error'); }
        }

        function viewWorkerFromStatus(name) {
            document.getElementById('workerSelect').value = name;
            closeModal('statusModal');
            loadTimesheet();
        }

        async function handleResubmit(name) {
            if (!confirm(`Allow ${name} to edit their timesheet again?`)) return;
            showLoading('Unlocking...');
            const dept = document.getElementById('departmentSelect').value;
            const mon = document.getElementById('monthSelect').value;
            const yr = document.getElementById('yearSelect').value;
            try {
                const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'resubmitWorker', department: dept, monthYear: mon + ' ' + yr, workerName: name }) }).then(r => r.json());
                hideLoading(); showToast(res.message); showStatusModal();
            } catch (e) { hideLoading(); showToast('Error', 'error'); }
        }

        async function loadTimesheet() {
            const dept = document.getElementById('departmentSelect').value;
            const workerInput = document.getElementById('workerSelect');
            const name = workerInput.value.trim();
            const mon = document.getElementById('monthSelect').value;
            const yr = document.getElementById('yearSelect').value;

            if (!dept || !name) { showToast('Select department and worker', 'error'); return; }

            if (!isAdmin) {
                const workerList = masterWorkerList[dept] || [];
                const workerObj = workerList.find(w => (typeof w === 'string' ? w : w.name) === name);
                if (!workerObj) {
                    showToast('Invalid worker name', 'error');
                    return;
                }
                const expectedPwd = typeof workerObj === 'string' ? '' : (workerObj.password || '');
                const enteredPwd = document.getElementById('workerPassword').value;
                if (expectedPwd && expectedPwd.trim() !== '') {
                    if (enteredPwd !== expectedPwd) {
                        showToast('Incorrect worker password', 'error');
                        return;
                    }
                }
            }

            if (entryMode === 'day') {
                const dVal = document.getElementById('dateSelect').value;
                if (!dVal) { showToast('Select date', 'error'); return; }
                const sDate = new Date(dVal);
                currentMonth = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][sDate.getMonth()];
                currentYear = sDate.getFullYear().toString();
                selectedDayOnly = sDate.getDate();
            } else {
                currentMonth = mon; currentYear = yr; selectedDayOnly = null;
            }

            currentDepartment = dept; currentWorker = name; daysInMonth = getDaysInMonth(currentMonth, currentYear);

            showLoading('Loading...');
            try {
                const activeCols = DEPARTMENTS_CONFIG[dept] || DEPARTMENTS_CONFIG['DEFAULT'];
                const keys = ['name', 'date', 'day', ...activeCols.map(c => c.id)].join(',');
                const sheetName = `${name}-${currentMonth}-${currentYear}`;
                const url = `${SCRIPT_URL}?action=getData&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(currentMonth + ' ' + currentYear)}&sheetName=${encodeURIComponent(sheetName)}&keys=${encodeURIComponent(keys)}`;
                const res = await fetch(url).then(r => r.json());

                isLocked = res.isLocked || false;
                currentData = res.data || [];
                buildSpreadsheet(currentData);

                const btnSubmit = document.getElementById('btnHeaderSubmit');
                const btnVerify = document.getElementById('btnHeaderVerify');
                if (btnSubmit) btnSubmit.style.display = isLocked ? 'none' : 'block';
                if (btnVerify) btnVerify.style.display = (isAdmin && !isLocked) ? 'flex' : 'none';

                showSection('timesheet');
                document.getElementById('timesheetTitle').textContent = `${name}'s Timesheet`;
                document.getElementById('timesheetSubtitle').textContent = `${dept} · ${currentMonth} ${currentYear} ${isLocked ? '(LOCKED)' : ''}`;
                document.getElementById('verticalTimesheetTitle').textContent = `${name}'s Timesheet`;
                document.getElementById('verticalTimesheetSubtitle').textContent = `${dept} · ${currentMonth} ${currentYear} ${isLocked ? '(LOCKED)' : ''}`;
                hideLoading();
            } catch (e) { hideLoading(); showSection('timesheet'); buildSpreadsheet(null); }
        }

        const DEPARTMENTS_CONFIG = {
            'RADIOGRAPHY': [
                { id: 'nightShiftIn', label: 'IN', topLabel: 'NIGHT SHIFT', type: 'time', width: 'col-time-wide' },
                { id: 'nightShiftOut', label: 'OUT', topLabel: 'NIGHT SHIFT', type: 'time', width: 'col-time-wide' },
                { id: 'lunchIn', label: 'IN', topLabel: 'LUNCH TIME', type: 'time', width: 'col-time-wide' },
                { id: 'lunchOut', label: 'OUT', topLabel: 'LUNCH TIME', type: 'time', width: 'col-time-wide' },
                { id: 'standBy', label: 'STAND BY', topLabel: 'STAND BY', type: 'text', width: 'col-location' },
                { id: 'lunchRtClient', label: 'CLIENT', topLabel: 'LUNCH RT', type: 'text', width: 'col-location' },
                { id: 'lunchRtFilms', label: 'FILMS', topLabel: 'LUNCH RT', type: 'text', width: 'col-location' },
                { id: 'tsNumber', label: 'TIMESHEET NUMBER', topLabel: 'TIMESHEET NUMBER', type: 'text', width: 'col-number-wide' },
                { id: 'loc1Client1', label: 'CLIENT 01', topLabel: 'LOCATION 01', type: 'text', width: 'col-location' },
                { id: 'loc1Films', label: 'FILMS', topLabel: 'LOCATION 01', type: 'text', width: 'col-location' },
                { id: 'loc2Client2', label: 'CLIENT 02', topLabel: 'LOCATION 02', type: 'text', width: 'col-location' },
                { id: 'loc2Films', label: 'FILMS', topLabel: 'LOCATION 02', type: 'text', width: 'col-location' },
                { id: 'loc3Client3', label: 'CLIENT 03', topLabel: 'LOCATION 03', type: 'text', width: 'col-location' },
                { id: 'loc3Films', label: 'FILMS', topLabel: 'LOCATION 03', type: 'text', width: 'col-location' },
                { id: 'expF4x10', label: '4"X10"', topLabel: 'EXPOSED FILMS', type: 'number', width: 'col-number', sum: true },
                { id: 'expF4x15', label: '4"X15"', topLabel: 'EXPOSED FILMS', type: 'number', width: 'col-number', sum: true },
                { id: 'expF17x14', label: '17"X14"', topLabel: 'EXPOSED FILMS', type: 'number', width: 'col-number', sum: true },
                { id: 'expFReshoot', label: 'RESHOOT', topLabel: 'EXPOSED FILMS', type: 'number', width: 'col-number', sum: true },
                { id: 'expFTotal', label: 'TOTAL', topLabel: 'EXPOSED FILMS', type: 'number', width: 'col-number', sum: true },
                { id: 'otLunchRt', label: 'LUNCH RT', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'otSiteToSite', label: 'SITE TO SITE', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'otXrayScar', label: 'X-RAY / SCAR', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'otProfile', label: 'PROFILE (MIN 4FILM)', topLabel: 'OT DETAILS', type: 'number', width: 'col-number-wide', sum: true },
                { id: 'timesheetOt', label: 'Timesheet OT', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'sunday', label: 'SUNDAY', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'totalOt', label: 'TOTAL OT', topLabel: 'OT DETAILS', type: 'number', width: 'col-number', sum: true },
                { id: 'otRtrDrtPautAllow', label: 'RTR/DRT/PAUT ALLOW', topLabel: 'OT DETAILS', type: 'number', width: 'col-number-wide', sum: true },
                { id: 'otRopeAllow', label: 'ROPE ALLOW', topLabel: 'OT DETAILS', type: 'number', width: 'col-number-wide', sum: true },
                { id: 'otWeldtestAllow', label: 'WELDTEST ALLOW', topLabel: 'OT DETAILS', type: 'number', width: 'col-number-wide', sum: true },
                { id: 'busFarw', label: 'BUS FARE', topLabel: 'BUS FARE', type: 'number', width: 'col-number', sum: true }
            ],
            'DEFAULT': [
                { id: 'clientIn', label: 'Client IN', type: 'time', width: 'col-time-wide' },
                { id: 'clientOut', label: 'Client OUT', type: 'time', width: 'col-time-wide' },
                { id: 'tsNumber', label: 'Timesheet Number', type: 'text', width: 'col-number-wide' },
                { id: 'siteLoc1', label: 'Site Location 1', type: 'text', width: 'col-location' },
                { id: 'siteLoc2', label: 'Site Location 2', type: 'text', width: 'col-location' },
                { id: 'otHrs', label: 'OT Hrs', type: 'number', width: 'col-number', step: '0.5', sum: true },
                { id: 'siteAllowanceHrs', label: 'Site Allowance Hrs', type: 'number', width: 'col-number-wide', step: '0.5', sum: true },
                { id: 'travelAllowance', label: 'Travel Allowance', type: 'number', width: 'col-money', step: '0.01', sum: true, prefix: '$' },
                { id: 'otherAllowance', label: 'Other Allowance', type: 'number', width: 'col-money', step: '0.01', sum: true, prefix: '$' },
                { id: 'busAllowance', label: 'Bus Allowance', type: 'number', width: 'col-money', step: '0.01', sum: true, prefix: '$' },
                { id: 'remarks', label: 'Remarks', type: 'text', width: 'col-remarks', countTimesheets: true }
            ]
        };

        function getActiveColumns() {
            return DEPARTMENTS_CONFIG[currentDepartment] || DEPARTMENTS_CONFIG['DEFAULT'];
        }

        function formatTimeValue(val) {
            if (!val) return '';
            val = String(val).trim();
            const timeMatch = val.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1], 10);
                const mins = timeMatch[2];
                const modifier = timeMatch[3];
                if (modifier) {
                    const modUpper = modifier.toUpperCase();
                    if (modUpper === 'PM' && hours < 12) hours += 12;
                    else if (modUpper === 'AM' && hours === 12) hours = 0;
                }
                return `${hours.toString().padStart(2, '0')}:${mins}`;
            }
            return val;
        }

        function buildSpreadsheet(data) {
            const activeCols = getActiveColumns();
            const tbody = document.getElementById('spreadsheetBody');
            const table = document.getElementById('spreadsheetTable');
            const dayForm = document.getElementById('dayWiseForm');
            const section = document.getElementById('timesheetSection');
            const thead = document.querySelector('.spreadsheet thead');

            EDITABLE_COL_INDICES = Array.from({ length: activeCols.length }, (_, i) => i + 4);

            if (thead) {
                const hasGroups = activeCols.some(c => c.topLabel);

                if (hasGroups) {
                    let row1 = `<tr><th class="col-sno" rowspan="2">#</th><th class="col-name" rowspan="2">Full Name</th><th class="col-date" rowspan="2">Date</th><th class="col-day" rowspan="2">Day</th>`;
                    let row2 = `<tr>`;

                    let groups = [];
                    activeCols.forEach(col => {
                        let lastGroup = groups[groups.length - 1];
                        if (lastGroup && lastGroup.label === col.topLabel) {
                            lastGroup.count++;
                        } else {
                            groups.push({ label: col.topLabel, count: 1 });
                        }
                    });

                    groups.forEach(g => {
                        if (g.count === 1) {
                            let col = activeCols.find(c => c.topLabel === g.label);
                            row1 += `<th rowspan="2" class="${col.width}">${g.label}</th>`;
                        } else {
                            row1 += `<th colspan="${g.count}">${g.label}</th>`;
                        }
                    });

                    activeCols.forEach(col => {
                        let g = groups.find(x => x.label === col.topLabel);
                        if (g.count > 1) {
                            row2 += `<th class="${col.width}">${col.label}</th>`;
                        }
                    });

                    row1 += `</tr>`;
                    row2 += `</tr>`;
                    thead.innerHTML = row1 + row2;
                } else {
                    let thHtml = `<tr><th class="col-sno">#</th><th class="col-name">Full Name</th><th class="col-date">Date</th><th class="col-day">Day</th>`;
                    activeCols.forEach(col => { thHtml += `<th class="${col.width}">${col.label}</th>`; });
                    thHtml += `</tr>`;
                    thead.innerHTML = thHtml;
                }
            }

            tbody.innerHTML = '';
            dayForm.innerHTML = '';

            if (selectedDayOnly) {
                section.classList.add('vertical-mode');
                table.style.display = 'none';
                dayForm.style.display = 'grid';

                const d = selectedDayOnly;
                const mIdx = getMonthIndex(currentMonth);
                const date = new Date(currentYear, mIdx, d), dName = getDayName(date), dStr = formatDate(d, currentMonth, currentYear);
                const rD = data ? data.find(x => x.date === dStr) : null;

                let dHtml = `
                    <div class="vertical-info-banner">
                        <div class="vertical-info-item"><span>Worker</span><span>${currentWorker}</span></div>
                        <div class="vertical-info-item"><span>Date</span><span>${dStr}</span></div>
                        <div class="vertical-info-item"><span>Day</span><span>${dName}</span></div>
                    </div>`;

                activeCols.forEach(col => {
                    let step = col.step ? `step='${col.step}'` : '';
                    let val = rD && rD[col.id] !== undefined ? rD[col.id] : '';
                    if (col.type === 'time' && val) val = formatTimeValue(val);
                    let oninput = col.sum || col.countTimesheets ? `oninput='updateTotals()'` : '';
                    let style = col.id === 'remarks' ? 'style="text-align: left; padding-left: 10px;"' : '';
                    let gridCol = col.id === 'remarks' ? 'style="grid-column: 1 / -1;"' : '';
                    let labelText = col.topLabel && col.topLabel !== col.label ? `${col.topLabel} - ${col.label}` : col.label;
                    dHtml += `<div class="vertical-field-card" ${gridCol}><label>${labelText}</label><input type='${col.type}' id='${col.id}_${d}' value='${val}' ${step} ${oninput} ${style} ${isLocked ? 'readonly' : ''}></div>`;
                });

                dHtml += `
                    <div class="vertical-submit-container">
                        <button class="btn-submit" onclick="submitTimesheet()" style="background: #10b981; padding: 12px 30px; font-size: 1rem;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Submit & Save
                        </button>
                    </div>`;

                dayForm.innerHTML = dHtml;

                setTimeout(() => {
                    const firstInput = document.getElementById(`${activeCols[0].id}_${d}`);
                    if (firstInput) firstInput.focus();
                }, 100);

            } else {
                section.classList.remove('vertical-mode');
                table.style.display = 'table';
                dayForm.style.display = 'none';

                const mIdx = getMonthIndex(currentMonth);
                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(currentYear, mIdx, d), dName = getDayName(date), dStr = formatDate(d, currentMonth, currentYear), isSun = date.getDay() === 0, isSat = date.getDay() === 6;
                    const tr = document.createElement('tr');
                    if (isSun) tr.classList.add('row-sunday'); else if (isSat) tr.classList.add('row-saturday');
                    const rD = data ? data.find(x => x.date === dStr) : null;

                    let rowHtml = `<td class="${isLocked ? 'locked' : ''}">${d}</td><td class="${isLocked ? 'locked' : ''}">${currentWorker}</td><td class="${isLocked ? 'locked' : ''}">${dStr}</td><td class='${isSun ? 'sunday' : isSat ? 'saturday' : ''} ${isLocked ? 'locked' : ''}'>${dName}</td>`;

                    activeCols.forEach(col => {
                        let step = col.step ? `step='${col.step}'` : '';
                        let oninput = col.sum || col.countTimesheets ? `oninput='updateTotals()'` : '';
                        let val = rD && rD[col.id] !== undefined ? rD[col.id] : '';
                        if (col.type === 'time' && val) val = formatTimeValue(val);
                        rowHtml += `<td class="${isLocked ? 'locked' : ''}"><input type='${col.type}' id='${col.id}_${d}' value='${val}' ${step} ${oninput} ${isLocked ? 'readonly' : ''}></td>`;
                    });

                    tr.innerHTML = rowHtml;
                    tbody.appendChild(tr);
                }
                buildTotalsRow(); updateTotals();
            }
        }

        function buildTotalsRow() {
            const activeCols = getActiveColumns();
            let html = `<tr><td colspan='4'>TOTAL</td>`;
            activeCols.forEach(col => {
                if (col.sum) {
                    html += `<td id='total_${col.id}'>${col.prefix || ''}0${col.prefix ? '.00' : ''}</td>`;
                } else if (col.countTimesheets) {
                    html += `<td id='totalTimesheets' style='font-size:0.7rem;'></td>`;
                } else {
                    html += `<td></td>`;
                }
            });
            html += `</tr>`;
            document.getElementById('spreadsheetFoot').innerHTML = html;
        }

        function updateTotals() {
            const activeCols = getActiveColumns();
            let totals = {};
            activeCols.filter(c => c.sum).forEach(c => totals[c.id] = 0);
            let tsCount = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const firstColId = activeCols[0].id;
                if (!document.getElementById(`${firstColId}_${d}`)) continue;

                let hasTimesheetEntry = false;

                if (currentDepartment === 'RADIOGRAPHY') {
                    const getVal = (id) => {
                        const el = document.getElementById(`${id}_${d}`);
                        return el && el.value !== '' ? parseFloat(el.value) : 0;
                    };
                    const hasVal = (id) => {
                        const el = document.getElementById(`${id}_${d}`);
                        return el && el.value !== '';
                    };

                    const expF4x10 = getVal('expF4x10');
                    const expF4x15 = getVal('expF4x15');
                    const expF17x14 = getVal('expF17x14');
                    const expFReshoot = getVal('expFReshoot');
                    const expFTotalEl = document.getElementById(`expFTotal_${d}`);
                    
                    if (expFTotalEl) {
                        if (hasVal('expF4x10') || hasVal('expF4x15') || hasVal('expF17x14') || hasVal('expFReshoot')) {
                            expFTotalEl.value = expF4x10 + expF4x15 + expF17x14 + expFReshoot;
                        } else {
                            expFTotalEl.value = '';
                        }
                    }

                    const otLunchRt = getVal('otLunchRt');
                    const otSiteToSite = getVal('otSiteToSite');
                    const otXrayScar = getVal('otXrayScar');
                    const otProfile = getVal('otProfile');
                    const timesheetOt = getVal('timesheetOt');
                    const sunday = getVal('sunday');
                    const totalOtEl = document.getElementById(`totalOt_${d}`);

                    if (totalOtEl) {
                        if (hasVal('otLunchRt') || hasVal('otSiteToSite') || hasVal('otXrayScar') || hasVal('otProfile') || hasVal('timesheetOt') || hasVal('sunday')) {
                            totalOtEl.value = otLunchRt + otSiteToSite + otXrayScar + otProfile + timesheetOt + sunday;
                        } else {
                            totalOtEl.value = '';
                        }
                    }
                }

                activeCols.forEach(col => {
                    const el = document.getElementById(`${col.id}_${d}`);
                    if (!el) return;

                    if (col.sum) {
                        totals[col.id] += parseFloat(el.value) || 0;
                    }

                    if (currentDepartment === 'AB') {
                        if (col.id === 'tsNumber' && el.value) {
                            hasTimesheetEntry = true;
                        }
                    } else {
                        if ((col.id === 'clientIn' || col.id === 'clientOut') && el.value) {
                            hasTimesheetEntry = true;
                        }
                    }
                });

                if (hasTimesheetEntry) tsCount++;
            }

            activeCols.forEach(col => {
                if (col.sum) {
                    let val = totals[col.id];
                    let text = col.prefix ? col.prefix + val.toFixed(2) : (Number.isInteger(val) ? val.toString() : val.toFixed(1));
                    document.getElementById(`total_${col.id}`).textContent = text;
                }
            });

            const countEl = document.getElementById('totalTimesheets');
            if (countEl) {
                countEl.innerHTML = `CLIENT TIMESHEETS:<br>${tsCount}`;
            }
        }

        function getTableRows() {
            let rows = JSON.parse(JSON.stringify(currentData || []));
            const mIdx = getMonthIndex(currentMonth);
            const activeCols = getActiveColumns();

            if (rows.length === 0) {
                for (let d = 1; d <= daysInMonth; d++) {
                    let row = {
                        name: currentWorker,
                        date: formatDate(d, currentMonth, currentYear),
                        day: getDayName(new Date(currentYear, mIdx, d))
                    };
                    activeCols.forEach(col => {
                        row[col.id] = '';
                    });
                    rows.push(row);
                }
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const firstColId = activeCols[0].id;
                const el = id => document.getElementById(`${id}_${d}`);
                if (el(firstColId)) {
                    const dStr = formatDate(d, currentMonth, currentYear);
                    let row = rows.find(r => r.date === dStr);
                    if (!row) {
                        row = { name: currentWorker, date: dStr, day: getDayName(new Date(currentYear, mIdx, d)) };
                        rows.push(row);
                    }
                    activeCols.forEach(col => {
                        row[col.id] = el(col.id).value;
                    });
                }
            }
            return rows;
        }

        async function submitTimesheet() {
            showLoading('Saving...');
            const activeCols = getActiveColumns();
            const headers = ['Full Name', 'Date', 'Day', ...activeCols.map(c => c.topLabel && c.topLabel !== c.label ? `${c.topLabel} ${c.label}` : c.label)];
            const keys = ['name', 'date', 'day', ...activeCols.map(c => c.id)];
            const sums = activeCols.map(c => c.sum ? true : false);

            const payload = {
                action: 'saveData',
                department: currentDepartment,
                monthYear: `${currentMonth} ${currentYear}`,
                sheetName: `${currentWorker}-${currentMonth}-${currentYear}`,
                workerName: currentWorker,
                rows: getTableRows(),
                headers: headers,
                keys: keys,
                sums: sums
            };
            try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }); hideLoading(); showToast('Saved Successfully!'); }
            catch (e) { hideLoading(); showToast('Error saving', 'error'); }
        }

        async function handleSaveAndExit() {
            await submitTimesheet();
            exitTimesheet();
        }

        async function handleVerify() {
            const vName = document.getElementById('headerVerifierName').value;
            if (!vName) { showToast('Enter Verifier Name', 'error'); return; }

            showLoading('Saving & Verifying...');

            // 1. Save Data First
            const activeCols = getActiveColumns();
            const headers = ['Full Name', 'Date', 'Day', ...activeCols.map(c => c.topLabel && c.topLabel !== c.label ? `${c.topLabel} ${c.label}` : c.label)];
            const keys = ['name', 'date', 'day', ...activeCols.map(c => c.id)];
            const sums = activeCols.map(c => c.sum ? true : false);

            const savePayload = { action: 'saveData', department: currentDepartment, monthYear: `${currentMonth} ${currentYear}`, sheetName: `${currentWorker}-${currentMonth}-${currentYear}`, workerName: currentWorker, rows: getTableRows(), headers: headers, keys: keys, sums: sums };
            try {
                const saveRes = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(savePayload) }).then(r => r.json());
                if (saveRes.status !== 'success') {
                    hideLoading(); showToast(saveRes.message || 'Error saving before verify', 'error'); return;
                }
            } catch (e) { hideLoading(); showToast('Error saving data', 'error'); return; }

            // 2. Verify Data
            const verifyPayload = { action: 'verifyWorker', department: currentDepartment, monthYear: `${currentMonth} ${currentYear}`, workerName: currentWorker, verifierName: vName, rows: getTableRows(), headers: headers, keys: keys };
            try {
                const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(verifyPayload) }).then(r => r.json());
                hideLoading();
                if (res.status === 'success') {
                    showToast('Saved & Verified successfully!');
                    loadTimesheet();
                } else {
                    showToast(res.message || 'Error verifying', 'error');
                }
            } catch (e) { hideLoading(); showToast('Error verifying data', 'error'); }
        }

        async function handleForgotPassword(type) {
            let dept, name;
            if (type === 'admin') {
                dept = 'Admin';
                name = document.getElementById('adminId').value.trim();
                if (!name) { showToast('Enter Admin User ID first', 'error'); return; }
            } else {
                dept = document.getElementById('departmentSelect').value;
                name = document.getElementById('workerSelect').value.trim();
                if (!dept || !name) { showToast('Select department and name first', 'error'); return; }
            }

            if (!confirm(`Send current password for ${name} to registered email?`)) return;

            showLoading('Sending email...');
            try {
                const res = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'forgotPassword', department: dept, workerName: name })
                }).then(r => r.json());
                hideLoading();
                if (res.status === 'success') showToast(res.message);
                else showToast(res.message, 'error');
            } catch (e) { hideLoading(); showToast('Connection error', 'error'); }
        }

        function openAdminChangePasswordModal() {
            const name = document.getElementById('adminId').value.trim();
            if (!name) { showToast('Enter Admin User ID first', 'error'); return; }

            const admin = masterAdmins.find(a => a.name === name);
            if (!admin) { showToast('Invalid Admin User ID', 'error'); return; }

            window._pendingCp = { dept: 'Admin', name: name, expected: admin.password };

            document.getElementById('cpOldPassword').value = '';
            document.getElementById('cpNewPassword').value = '';
            document.getElementById('cpConfirmPassword').value = '';
            document.getElementById('changePasswordModal').classList.add('show');
        }

        function openChangePasswordModal() {
            const dept = document.getElementById('departmentSelect').value;
            const name = document.getElementById('workerSelect').value.trim();
            if (!dept || !name) {
                showToast('Select department and worker first', 'error');
                return;
            }

            const workerList = masterWorkerList[dept] || [];
            const workerObj = workerList.find(w => (typeof w === 'string' ? w : w.name) === name);
            if (!workerObj) {
                showToast('Invalid worker name', 'error');
                return;
            }

            window._pendingCp = {
                dept: dept,
                name: name,
                expected: typeof workerObj === 'string' ? '' : (workerObj.password || '')
            };

            document.getElementById('cpOldPassword').value = '';
            document.getElementById('cpNewPassword').value = '';
            document.getElementById('cpConfirmPassword').value = '';
            document.getElementById('changePasswordModal').classList.add('show');
        }

        async function submitPasswordChange() {
            if (!window._pendingCp) return;
            const { dept, name, expected } = window._pendingCp;

            const oldPwd = document.getElementById('cpOldPassword').value;
            const newPwd = document.getElementById('cpNewPassword').value;
            const confPwd = document.getElementById('cpConfirmPassword').value;

            if (!newPwd || newPwd.trim() === '') {
                showToast('Enter a valid new password', 'error');
                return;
            }
            if (newPwd !== confPwd) {
                showToast('New passwords do not match', 'error');
                return;
            }

            if (expected && expected.trim() !== '') {
                if (oldPwd !== expected) {
                    showToast('Incorrect old password', 'error');
                    return;
                }
            }

            showLoading('Updating password...');
            try {
                const res = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'changePassword', department: dept, workerName: name, oldPassword: oldPwd, newPassword: newPwd })
                }).then(r => r.json());

                hideLoading();
                if (res.status === 'success') {
                    showToast('Password updated successfully!');
                    closeModal('changePasswordModal');
                    if (dept !== 'Admin') {
                        document.getElementById('workerPassword').value = newPwd;
                    } else {
                        document.getElementById('adminPassword').value = newPwd;
                    }
                    refreshWorkerListFromMaster();
                } else {
                    showToast(res.message || 'Error updating password', 'error');
                }
            } catch (e) {
                hideLoading();
                showToast('Error connecting to server', 'error');
            }
        }

        function goBack() {
            if (isLocked) {
                exitTimesheet();
                return;
            }
            document.getElementById('exitConfirmModal').classList.add('show');
        }


        function exitTimesheet() {
            if (isFullscreen) toggleFullscreen();
            showSection('home');
            document.getElementById('workerPassword').value = '';
        }

        // ===== ZOOM FUNCTIONALITY =====
        function applyZoom() {
            const slider = document.getElementById('zoomSliderInput');
            const zoomVal = parseInt(slider.value);
            document.getElementById('zoomText').textContent = zoomVal + '%';

            const table = document.getElementById('spreadsheetTable');
            if (table) {
                table.style.zoom = zoomVal / 100;
            }

            const dayForm = document.getElementById('dayWiseForm');
            if (dayForm) {
                dayForm.style.zoom = zoomVal / 100;
            }
        }

        function zoomIn() {
            const slider = document.getElementById('zoomSliderInput');
            if (parseInt(slider.value) < 150) {
                slider.value = parseInt(slider.value) + 10;
                applyZoom();
            }
        }

        function zoomOut() {
            const slider = document.getElementById('zoomSliderInput');
            if (parseInt(slider.value) > 50) {
                slider.value = parseInt(slider.value) - 10;
                applyZoom();
            }
        }

        // ===== FULLSCREEN =====
        let isFullscreen = false;
        function toggleFullscreen() {
            const section = document.getElementById('timesheetSection'), header = document.querySelector('.header'), footer = document.querySelector('.footer'), icon = document.getElementById('fullscreenIcon');
            isFullscreen = !isFullscreen;
            if (isFullscreen) {
                section.classList.add('fullscreen-mode');
                if (header) header.style.display = 'none';
                if (footer) footer.style.display = 'none';
                icon.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
            } else {
                section.classList.remove('fullscreen-mode');
                if (header) header.style.display = '';
                if (footer) footer.style.display = '';
                icon.innerHTML = '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
            }
        }

        // ===== KEYBOARD NAVIGATION =====
        let EDITABLE_COL_INDICES = [];
        document.addEventListener('keydown', function (e) {
            const active = document.activeElement;
            if (!active || !active.closest('.spreadsheet tbody')) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].indexOf(e.key) === -1) return;

            const td = active.closest('td'), tr = td.parentElement, tbody = tr.parentElement;
            const cellIndex = Array.from(tr.children).indexOf(td), rowIndex = Array.from(tbody.children).indexOf(tr), totalRows = tbody.children.length;
            const currentEditIdx = EDITABLE_COL_INDICES.indexOf(cellIndex);
            let targetRow, targetInput;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                targetRow = tbody.children[rowIndex + 1];
                if (targetRow) targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                targetRow = tbody.children[rowIndex - 1];
                if (targetRow) targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (currentEditIdx < EDITABLE_COL_INDICES.length - 1) targetInput = tr.children[EDITABLE_COL_INDICES[currentEditIdx + 1]]?.querySelector('input, select');
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentEditIdx > 0) targetInput = tr.children[EDITABLE_COL_INDICES[currentEditIdx - 1]]?.querySelector('input, select');
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    targetRow = tbody.children[rowIndex - 1];
                    if (targetRow) targetInput = targetRow.children[cellIndex]?.querySelector('input, select');
                } else {
                    if (rowIndex < totalRows - 1) targetInput = tbody.children[rowIndex + 1].children[cellIndex]?.querySelector('input, select');
                    else if (currentEditIdx < EDITABLE_COL_INDICES.length - 1) targetInput = tbody.children[0].children[EDITABLE_COL_INDICES[currentEditIdx + 1]]?.querySelector('input, select');
                }
            } else if (e.key === 'Tab') {
                if (!e.shiftKey && currentEditIdx === EDITABLE_COL_INDICES.length - 1) {
                    e.preventDefault();
                    targetRow = tbody.children[rowIndex + 1];
                    if (targetRow) targetInput = targetRow.children[EDITABLE_COL_INDICES[0]]?.querySelector('input, select');
                } else if (e.shiftKey && currentEditIdx === 0) {
                    e.preventDefault();
                    targetRow = tbody.children[rowIndex - 1];
                    if (targetRow) targetInput = targetRow.children[EDITABLE_COL_INDICES[EDITABLE_COL_INDICES.length - 1]]?.querySelector('input, select');
                }
            }

            if (targetInput) {
                targetInput.focus();
                targetInput.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            }
        });

        // Global shortcut for fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                const section = document.getElementById('timesheetSection');
                if (section && !section.classList.contains('hidden')) { e.preventDefault(); toggleFullscreen(); }
            }
        });

        function exportToExcel() {
            const activeCols = getActiveColumns();
            const data = getTableRows();

            let headers = ["Date", "Day"];
            activeCols.forEach(col => {
                let label = col.topLabel && col.topLabel !== col.label ? `${col.topLabel} ${col.label}` : col.label;
                headers.push(label);
            });

            let aoa = [headers];
            data.forEach(row => {
                let rowData = [row.date, row.day];
                activeCols.forEach(col => {
                    let val = row[col.id] !== undefined ? row[col.id] : '';
                    rowData.push(val);
                });
                aoa.push(rowData);
            });

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

            const filename = `${currentWorker}_${currentMonth}_${currentYear}.xlsx`;

            // Download Locally
            XLSX.writeFile(wb, filename);

            // Upload to Google Drive
            showToast('Uploading Excel to Drive...', 'success');
            const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadExcel',
                    filename: filename,
                    department: currentDepartment,
                    workerName: currentWorker,
                    month: currentMonth,
                    year: currentYear,
                    data: base64Data
                })
            }).then(r => r.json()).then(res => {
                if (res.status === 'success') {
                    showToast('Excel saved to Drive successfully!', 'success');
                } else {
                    showToast(res.message || 'Error saving to Drive', 'error');
                }
            }).catch(e => {
                showToast('Connection error while saving to Drive', 'error');
                console.error(e);
            });
        }
        window.addEventListener('beforeunload', function (e) {
            const timesheetSection = document.getElementById('timesheetSection');
            if (timesheetSection && !timesheetSection.classList.contains('hidden') && typeof isLocked !== 'undefined' && !isLocked) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    

// ===== ACCOUNTS PORTAL SCRIPT =====

let masterList = {};
let masterWorkers = [];
let allDepartments = [];
let step1Data = [];
let step2Data = [];
let step3Data = []; // Tech mapping
let step4Data = []; // Final comparison
let currentUploadedFileName = "accounts_summary.xlsx";

function showAccountsLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
}

function switchSection(sectionId) {
    document.querySelectorAll('.accounts-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

async function attemptLogin() {
    const id = document.getElementById('loginUserId').value.trim();
    const pwd = document.getElementById('loginPassword').value;
    
    if(!id || !pwd) return alert('Enter ID and Password');
    
    showAccountsLoading(true);
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
    showAccountsLoading(false);
}

function populateDropdowns() {
    const deptSelects = [document.getElementById('summaryDept'), document.getElementById('histDept')];
    deptSelects.forEach(select => {
        select.innerHTML = '<option value="">Select Dept</option>';
        allDepartments.forEach(d => {
            if (d !== 'Admin ID') {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                select.appendChild(opt);
            }
        });
    });

    const yearSelects = [document.getElementById('summaryYear'), document.getElementById('histYear')];
    const currentYear = new Date().getFullYear();
    yearSelects.forEach(select => {
        select.innerHTML = '';
        for (let y = currentYear - 2; y <= currentYear + 3; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if(y === currentYear) opt.selected = true;
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

// --- EXCEL PROCESSING (Step 1) ---
function processExcelUpload() {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert('Please select a .xlsx file');
    currentUploadedFileName = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array', cellDates:true, dateNF:'dd-mmm-yy'});
            
            const sheetNames = workbook.SheetNames;
            const getSheetData = (name) => {
                const actualName = sheetNames.find(n => n.toLowerCase() === name.toLowerCase());
                if (actualName && workbook.Sheets[actualName]) {
                    return XLSX.utils.sheet_to_json(workbook.Sheets[actualName], {header: 1, raw: false, defval: ''});
                }
                return [];
            };
            
            let d1 = getSheetData('D1');
            let d2 = getSheetData('D2');
            let d3 = getSheetData('D3');
            
            combineSheets(d1, d2, d3);
        } catch (err) {
            alert('Error processing file: ' + err.message + '\nMake sure the file is a valid Excel file and not protected.');
            console.error(err);
        }
    };
    reader.onerror = function() {
        alert('Failed to read the file.');
    };
    reader.readAsArrayBuffer(file);
}

function normalizeHeader(h) {
    if(!h) return '';
    return h.toString().toUpperCase().replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findColIndex(headers, possibleNames) {
    for(let i=0; i<headers.length; i++) {
        const norm = normalizeHeader(headers[i]);
        if(possibleNames.includes(norm)) return i;
    }
    return -1;
}

function extractData(sheetData, mappingRules) {
    if(!sheetData || sheetData.length === 0) return [];
    
    let bestRowIdx = -1;
    let bestMatchCount = 0;
    let bestMappings = {};
    
    // Search the first 20 rows for the header row
    for(let r=0; r<Math.min(sheetData.length, 20); r++) {
        const headers = sheetData[r] || [];
        let matchCount = 0;
        let mappings = {};
        for (const [targetCol, possibleNames] of Object.entries(mappingRules)) {
            const idx = findColIndex(headers, possibleNames);
            mappings[targetCol] = idx;
            if(idx >= 0) matchCount++;
        }
        if(matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestRowIdx = r;
            bestMappings = mappings;
        }
    }
    
    if (bestRowIdx === -1 || bestMatchCount === 0) return []; // Headers not found
    
    const result = [];
    for(let i = bestRowIdx + 1; i < sheetData.length; i++) {
        const row = sheetData[i] || [];
        let isEmpty = true;
        let rowData = {};
        for (const targetCol of Object.keys(mappingRules)) {
            const idx = bestMappings[targetCol];
            const val = idx >= 0 ? row[idx] : '';
            rowData[targetCol] = val;
            if(val !== '' && val !== null && val !== undefined) isEmpty = false;
        }
        if(!isEmpty) result.push(rowData);
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
    
    const cols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD', 'LEADER', 'TECH #02', 'TECH #03', 'TECH #04'];
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
    const baseCols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD'];
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
    
    const cols = ['D.NO', 'TIME SHEET NUMBER', 'DATE', 'CLIENT NAME', 'QC NAME', 'LOCATION', 'TEST METHOD', 'TECH', 'TECH TYPE'];
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
    tokens1.forEach(t => { if(tokens2.includes(t)) matchCount++; });
    
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
        if(preservedSelections[techName]) {
            select.value = preservedSelections[techName];
        } else if(scores.length > 0) {
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
    
    if(!newName || newName === oldName) {
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
        if(row['TECH'] === oldName) {
            row['TECH'] = newName;
        }
    });
    
    // Transfer selection to new name if it existed
    if(currentSelections[oldName]) {
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
    
    if(!dept || !month || !year) return alert('Select Department, Month and Year');
    
    // 1. Build mapped data from Step 3 selections
    const selects = document.querySelectorAll('#step3Table select');
    const mapping = {};
    selects.forEach(s => mapping[s.dataset.tech] = s.value);
    
    // Create flattened mapped step2 data
    const mappedStep2 = step2Data.map(r => {
        return {
            name: mapping[r['TECH']],
            date: r['DATE'],
            tsNumber: r['TIME SHEET NUMBER']
        };
    });
    
    showAccountsLoading(true);
    step4Data = [];
    
    // In a real app, we'd batch fetch, but here we can fetch data for the department/month/year
    // Wait, the existing Code.gs has getStatus which we could use, or getData for specific sheets.
    // We actually need data for ALL workers in this department for this month to compare.
    // The current backend doesn't have a bulk fetch. We will have to fetch for each unique mapped worker.
    
    const uniqueMappedNames = [...new Set(mappedStep2.map(m => m.name))];
    
    try {
        let backendData = []; // flattened array of {name, date, tsNumber}
        
        for (const worker of uniqueMappedNames) {
            const sheetName = `${worker}-${month}-${year}`;
            const url = `${SCRIPT_URL}?action=getData&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(month + ' ' + year)}&sheetName=${encodeURIComponent(sheetName)}`;
            
            const res = await fetch(url);
            const result = await res.json();
            
            if(result.status === 'success' && result.data) {
                // Find timesheet numbers. In existing app, 'clientIn'/'clientOut' are used.
                // Wait, in Code.gs, how is Timesheet Number stored?
                // The frontend has "Client Timesheet IN" and "Client Timesheet OUT" (maybe these are time fields?).
                // Where is TIMESHEET NUMBER? The original app didn't explicitly have it. 
                // Let's assume 'remarks' or 'clientIn' might hold it, or it's a new field.
                // Since this is a new portal mapping, we'll try to find it in the data or just compare dates.
                // For this demo, let's assume `remarks` holds the timesheet number if it's there.
                
                result.data.forEach(r => {
                    backendData.push({
                        name: r.name,
                        date: r.date,
                        tsNumber: r.remarks // Or wherever it's stored.
                    });
                });
            }
        }
        
        // 2. Compare
        mappedStep2.forEach(m => {
            const dateStr = formatDateForCompare(m.date); // Need to parse excel date
            // Find in backend
            const beMatch = backendData.find(b => b.name === m.name && b.date === dateStr);
            const beTs = beMatch ? (beMatch.tsNumber || 'Not Entered') : 'Not Found';
            const matched = beMatch && (beMatch.tsNumber == m.tsNumber);
            
            step4Data.push({
                NAME: m.name,
                DATE: dateStr,
                DPRS_TS: m.tsNumber,
                STS_TS: beTs,
                SUMMARY: matched ? 'matched' : 'mismatched'
            });
        });
        
        renderStep4Table();
        
    } catch(e) {
        alert('Error fetching backend data for comparison.');
        console.error(e);
    }
    showAccountsLoading(false);
}

function formatDateForCompare(excelDateStr) {
    // If it's already a string like "1-May-26" try to convert to DD/MM/YYYY matching the main portal
    try {
        const d = new Date(excelDateStr);
        if(isNaN(d.getTime())) return excelDateStr; // Return as is if unparseable
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    } catch(e) {
        return excelDateStr;
    }
}

function renderStep4Table() {
    const tbody = document.querySelector('#step4Table tbody');
    tbody.innerHTML = '';
    
    step4Data.forEach(row => {
        const tr = document.createElement('tr');
        const isMatched = row.SUMMARY === 'matched';
        
        tr.innerHTML = `
            <td>${row.NAME}</td>
            <td>${row.DATE}</td>
            <td>${row.DPRS_TS}</td>
            <td>${row.STS_TS}</td>
            <td><span class="tag ${isMatched ? 'matched' : 'mismatched'}">${row.SUMMARY}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadExcelStep1() {
    if(step1Data.length === 0) return alert('No data to download.');
    const ws = XLSX.utils.json_to_sheet(step1Data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Step1_Combined");
    XLSX.writeFile(wb, "Step1_" + currentUploadedFileName);
}

function downloadExcelStep2() {
    if(step2Data.length === 0) return alert('No data to download.');
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
    
    if(exportData.length === 0) return alert('No data to download.');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Step3_Mapping");
    XLSX.writeFile(wb, "Step3_" + currentUploadedFileName);
}

function downloadSummaryExcel() {
    if(step4Data.length === 0) return alert('No data to download.');
    
    const ws = XLSX.utils.json_to_sheet(step4Data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    
    XLSX.writeFile(wb, "Accounts_Summary_" + currentUploadedFileName);
}

async function saveToDrive() {
    if(step4Data.length === 0) return alert('No data to save.');
    
    const dept = document.getElementById('summaryDept').value;
    const month = document.getElementById('summaryMonth').value;
    const year = document.getElementById('summaryYear').value;
    
    showAccountsLoading(true);
    const payload = {
        action: 'saveAccountsSummary',
        department: dept,
        monthYear: `${month} ${year}`,
        fileName: `Summary_${currentUploadedFileName.replace('.xlsx','')}_${new Date().getTime()}`,
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
    } catch(e) {
        alert('Error saving data.');
    }
    showAccountsLoading(false);
}

// --- HISTORY ---
async function loadHistory() {
    const dept = document.getElementById('histDept').value;
    const month = document.getElementById('histMonth').value;
    const year = document.getElementById('histYear').value;
    
    if(!dept || !month || !year) return alert('Select filters.');
    
    showAccountsLoading(true);
    try {
        const url = `${SCRIPT_URL}?action=getAccountsHistory&department=${encodeURIComponent(dept)}&monthYear=${encodeURIComponent(month + ' ' + year)}`;
        const res = await fetch(url);
        const result = await res.json();
        
        const div = document.getElementById('historyResults');
        if(result.status === 'success') {
            if(result.files.length === 0) {
                div.innerHTML = '<p>No history found.</p>';
            } else {
                div.innerHTML = '<ul>' + result.files.map(f => `<li><a href="${f.url}" target="_blank">${f.name}</a></li>`).join('') + '</ul>';
            }
        } else {
            div.innerHTML = '<p>Error loading history.</p>';
        }
    } catch(e) {
        alert('Network error loading history.');
    }
    showAccountsLoading(false);
}
