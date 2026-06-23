// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

function initApp() {
    // --- 1. View Routing & Navigation ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');
    let html5QrcodeScanner = null;

    function switchView(targetId) {
        // Update Active Link
        navLinks.forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-links a[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Show Target View
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) {
                view.classList.add('active');
            }
        });

        // Handle Scanner initialization
        if (targetId === 'scanner') {
            initScanner();
        } else {
            stopScanner();
        }

        // Handle Generator initialization
        if (targetId === 'generator') {
            initGenerator();
        }
    }

    function handleRouting() {
        const hash = window.location.hash || '#dashboard';
        let targetId = hash.substring(1);
        
        const currentUserStr = localStorage.getItem('lvmdp_user');
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
        
        // Hide Navigation if not logged in
        const mainNav = document.querySelector('nav.glass-nav');
        if (mainNav) {
            mainNav.style.display = currentUser ? 'flex' : 'none';
        }

        // Lock Settings
        if (targetId === 'settings') {
            const currentPinAuth = sessionStorage.getItem('lvmdp_admin_auth');
            if (currentPinAuth !== 'true') {
                const pin = prompt("Masukkan PIN Admin untuk mengakses Pengaturan:");
                if (pin === "admin123") {
                    sessionStorage.setItem('lvmdp_admin_auth', 'true');
                } else {
                    if (pin !== null) alert("PIN salah.");
                    targetId = currentUser ? 'dashboard' : 'login';
                    window.location.hash = '#' + targetId;
                    return;
                }
            }
        }

        // Route Guard
        if (!currentUser && targetId !== 'settings') {
            targetId = 'login';
            window.location.hash = '#login';
        } else if (currentUser && targetId === 'login') {
            targetId = 'dashboard';
            window.location.hash = '#dashboard';
        }
        
        // Show/Hide Logout Button
        const navLogout = document.getElementById('nav-logout');
        if (navLogout) {
            navLogout.style.display = currentUser ? 'block' : 'none';
        }

        // Auto-fill PIC
        if (currentUser) {
            const inputPicPreventive = document.getElementById('input-pic');
            if (inputPicPreventive && !inputPicPreventive.value) inputPicPreventive.value = currentUser.nama;
            
            const inputPicCorrective = document.getElementById('corrective-pic');
            if (inputPicCorrective && !inputPicCorrective.value) inputPicCorrective.value = currentUser.nama;
        }

        const targetView = document.getElementById(targetId);
        if (targetView && targetView.classList.contains('view')) {
            switchView(targetId);
        } else {
            window.location.hash = currentUser ? '#dashboard' : '#login';
        }
    }

    window.addEventListener('hashchange', handleRouting);
    handleRouting();

    // --- 1.5 Login Management ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const btnSubmit = document.getElementById('btn-submit-login');
            const loadingMsg = document.getElementById('login-loading');
            
            btnSubmit.disabled = true;
            loadingMsg.classList.remove('hidden');
            
            if (!navigator.onLine) {
                alert('Anda harus terhubung ke internet untuk melakukan login pertama kali.');
                btnSubmit.disabled = false;
                loadingMsg.classList.add('hidden');
                return;
            }

            try {
                const response = await fetch(getGasUrl(), {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'login',
                        username: username,
                        password: password
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                const result = await response.json();
                if (result.result === 'success') {
                    localStorage.setItem('lvmdp_user', JSON.stringify({
                        username: username,
                        nama: result.nama || username
                    }));
                    document.getElementById('login-username').value = '';
                    document.getElementById('login-password').value = '';
                    window.location.hash = '#dashboard';
                    handleRouting();
                } else {
                    alert('Login gagal: ' + (result.message || 'Username atau password salah'));
                }
            } catch (err) {
                alert('Error koneksi ke server. Pastikan URL Web App di Settings sudah benar.');
                console.error(err);
            } finally {
                btnSubmit.disabled = false;
                loadingMsg.classList.add('hidden');
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('lvmdp_user');
            window.location.hash = '#login';
        });
    }

    // --- 2. Settings Management ---
    const GAS_URL_KEY = 'lvmdp_gas_url';
    const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzQ-juLMbcymH_D-6tCLTGLIEWkNRXyyoH_OUzi4qystZnnMaDIT3ilDTA8Ujw98IiB/exec';
    const inputGasUrl = document.getElementById('input-gas-url');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    const savedUrl = localStorage.getItem(GAS_URL_KEY);
    if (savedUrl) {
        inputGasUrl.value = savedUrl;
    } else {
        inputGasUrl.value = DEFAULT_GAS_URL;
    }

    btnSaveSettings.addEventListener('click', () => {
        const url = inputGasUrl.value.trim();
        if (url) {
            localStorage.setItem(GAS_URL_KEY, url);
            alert('URL berhasil disimpan!');
        } else {
            alert('Mohon masukkan URL yang valid.');
        }
    });

    function getGasUrl() {
        return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
    }

    // --- 3. Generator Logic ---
    const qrListContainer = document.getElementById('qr-list');
    const areaFilter = document.getElementById('area-filter');
    const typeFilter = document.getElementById('type-filter');
    const btnPrintQr = document.getElementById('btn-print-qr');
    let isGeneratorInit = false;
    let currentRenderTimeout = null;
    let isGenerating = false;

    function initGenerator() {
        if (isGeneratorInit) return;

        if (typeof QRCode === 'undefined') {
            qrListContainer.innerHTML = '<div style="color: #f87171; padding: 20px; text-align: center; grid-column: 1/-1; font-weight: 500;">Gagal memuat pustaka QR Code generator (offline atau URL CDN tidak dapat diakses). Silakan segarkan halaman setelah terhubung ke internet.</div>';
            return;
        }

        Object.keys(lvmdpData).forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaFilter.appendChild(option);
        });

        // Set up Print button event
        if (btnPrintQr) {
            btnPrintQr.addEventListener('click', () => {
                if (isGenerating) {
                    alert('Mohon tunggu hingga seluruh QR Code selesai dibuat sebelum mencetak.');
                    return;
                }
                window.print();
            });
        }

        renderQRCodes('ALL', '');
        isGeneratorInit = true;

        areaFilter.addEventListener('change', (e) => {
            renderQRCodes(e.target.value, typeFilter.value);
        });

        if (typeFilter) {
            // Debounce function to prevent rendering on every keystroke
            let debounceTimeout = null;
            typeFilter.addEventListener('input', (e) => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    renderQRCodes(areaFilter.value, e.target.value);
                }, 300); // 300ms delay
            });
        }
    }

    function renderQRCodes(filterArea, filterType) {
        // Cancel any ongoing render
        if (currentRenderTimeout) {
            clearTimeout(currentRenderTimeout);
            currentRenderTimeout = null;
        }

        qrListContainer.innerHTML = '';
        const keyword = filterType ? filterType.toLowerCase().trim() : '';

        // Collect all items to render
        const itemsToRender = [];
        Object.keys(lvmdpData).forEach(area => {
            if (filterArea === 'ALL' || filterArea === area) {
                lvmdpData[area].forEach(peralatan => {
                    if (!keyword || peralatan.toLowerCase().includes(keyword)) {
                        itemsToRender.push({ area, peralatan });
                    }
                });
            }
        });

        if (itemsToRender.length === 0) {
            qrListContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-light);">Tidak ada panel yang sesuai filter.</div>';
            isGenerating = false;
            updatePrintButtonState(false, 0, 0);
            return;
        }

        isGenerating = true;

        // Show progress overlay/indicator (only visible in UI, hidden during print)
        const progressIndicator = document.createElement('div');
        progressIndicator.id = 'qr-progress-indicator';
        progressIndicator.className = 'no-print glass-card';
        progressIndicator.style.cssText = 'grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; margin-bottom: 20px; gap: 15px;';
        progressIndicator.innerHTML = `
            <div class="qr-spinner"></div>
            <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-main);">Membuat QR Code...</div>
            <div style="color: var(--text-light); font-size: 0.9rem;"><span id="qr-current-progress">0</span> dari ${itemsToRender.length} selesai</div>
            <div style="width: 100%; max-width: 300px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div id="qr-progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.1s ease; box-shadow: 0 0 10px var(--primary);"></div>
            </div>
        `;
        qrListContainer.appendChild(progressIndicator);

        const chunkSize = 6; // Batch size
        let index = 0;

        function renderBatch() {
            const end = Math.min(index + chunkSize, itemsToRender.length);
            for (let i = index; i < end; i++) {
                const item = itemsToRender[i];
                createQRLabel(item.area, item.peralatan);
            }
            index = end;

            // Update Progress in UI
            const currentProgressSpan = document.getElementById('qr-current-progress');
            const progressBar = document.getElementById('qr-progress-bar');
            if (currentProgressSpan) currentProgressSpan.textContent = index;
            if (progressBar) {
                const percent = (index / itemsToRender.length) * 100;
                progressBar.style.width = `${percent}%`;
            }

            updatePrintButtonState(true, index, itemsToRender.length);

            if (index < itemsToRender.length) {
                currentRenderTimeout = setTimeout(renderBatch, 15); // Yield to main thread for 15ms to keep UI responsive
            } else {
                // Done generating
                isGenerating = false;
                const indicator = document.getElementById('qr-progress-indicator');
                if (indicator) {
                    indicator.remove();
                }
                updatePrintButtonState(false, index, itemsToRender.length);
                currentRenderTimeout = null;
            }
        }

        renderBatch();
    }

    function updatePrintButtonState(active, current, total) {
        if (!btnPrintQr) return;
        if (active) {
            btnPrintQr.disabled = true;
            btnPrintQr.style.opacity = '0.6';
            btnPrintQr.style.cursor = 'not-allowed';
            btnPrintQr.innerHTML = `
                <div class="qr-spinner-small"></div>
                Memproses (${current}/${total})
            `;
        } else {
            btnPrintQr.disabled = false;
            btnPrintQr.style.opacity = '1';
            btnPrintQr.style.cursor = 'pointer';
            btnPrintQr.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20"
                    height="20" style="margin-right: 8px;">
                    <path
                        d="M7.5 3a.75.75 0 00-.75.75v2.25h10.5V3.75a.75.75 0 00-.75-.75h-9zM3.75 7.5A2.25 2.25 0 001.5 9.75v5.5A2.25 2.25 0 003.75 17.5h1.5v3.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5v-3.5h1.5a2.25 2.25 0 002.25-2.25v-5.5A2.25 2.25 0 0020.25 7.5H3.75zM6.75 16.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-9a.75.75 0 01-.75-.75v-4.5z" />
                </svg>
                Print Label
            `;
        }
    }

    function createQRLabel(area, peralatan) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'qr-label';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `<h4>${area}</h4><p>${peralatan}</p>`;
        labelDiv.appendChild(titleDiv);

        const qrDiv = document.createElement('div');
        qrDiv.className = 'qr-code-img';
        labelDiv.appendChild(qrDiv);

        qrListContainer.appendChild(labelDiv);

        const qrData = JSON.stringify({ a: area, p: peralatan });

        new QRCode(qrDiv, {
            text: qrData,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
    }

    // --- 4. Scanner Logic ---
    let isTorchOn = false;
    const btnTorch = document.getElementById('btn-toggle-torch');

    function initTorchButton() {
        if (!btnTorch) return;
        btnTorch.classList.add('hidden'); // Hide by default until scanner runs
        btnTorch.innerHTML = '🔦 Nyalakan Senter';
        isTorchOn = false;
    }

    if (btnTorch) {
        btnTorch.addEventListener('click', () => {
            if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
                const track = html5QrcodeScanner.getActiveTrack();
                if (track) {
                    try {
                        const capabilities = track.getCapabilities();
                        if (capabilities.torch) {
                            isTorchOn = !isTorchOn;
                            track.applyConstraints({
                                advanced: [{ torch: isTorchOn }]
                            }).then(() => {
                                btnTorch.innerHTML = isTorchOn ? '🔦 Matikan Senter' : '🔦 Nyalakan Senter';
                            }).catch(err => {
                                console.error("Failed to toggle torch", err);
                            });
                        } else {
                            alert("Flashlight/Senter tidak didukung pada kamera ini.");
                        }
                    } catch(e) {
                        console.error("Torch error:", e);
                    }
                }
            }
        });
    }

    function initScanner() {
        const scannerStatus = document.getElementById('scanner-status');
        if (html5QrcodeScanner) return;

        html5QrcodeScanner = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        scannerStatus.textContent = "Mencari kamera...";
        initTorchButton();

        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
                let cameraId = devices[0].id;
                for (let i = 0; i < devices.length; i++) {
                    if (devices[i].label.toLowerCase().includes('back') || devices[i].label.toLowerCase().includes('environment')) {
                        cameraId = devices[i].id;
                        break;
                    }
                }

                html5QrcodeScanner.start(
                    cameraId,
                    config,
                    onScanSuccess,
                    (errorMessage) => { }
                )
                    .then(() => {
                        scannerStatus.textContent = "Arahkan kamera ke QR Code";
                        // Check if camera track supports torch
                        setTimeout(() => {
                            try {
                                const track = html5QrcodeScanner.getActiveTrack();
                                if (track) {
                                    const capabilities = track.getCapabilities();
                                    if (capabilities.torch && btnTorch) {
                                        btnTorch.classList.remove('hidden'); // Show flashlight button!
                                    }
                                }
                            } catch(e) {
                                console.log("Failed to inspect torch capabilities:", e);
                            }
                        }, 500);
                    })
                    .catch((err) => {
                        scannerStatus.textContent = `Error starting camera: ${err}`;
                    });
            } else {
                scannerStatus.textContent = "Kamera tidak ditemukan.";
            }
        }).catch(err => {
            scannerStatus.textContent = `Error getting cameras: ${err}`;
        });
    }

    function stopScanner() {
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
                isTorchOn = false;
                if (btnTorch) {
                    btnTorch.classList.add('hidden');
                    btnTorch.innerHTML = '🔦 Nyalakan Senter';
                }
            }).catch(err => {
                console.error("Failed to stop scanner", err);
            });
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        try {
            const data = JSON.parse(decodedText);
            if (data.a && data.p) {
                if ('vibrate' in navigator) navigator.vibrate(200);
                stopScanner();
                showScanChoiceModal(data.a, data.p);
            } else {
                alert("QR Code tidak valid untuk aplikasi ini.");
            }
        } catch (e) {
            alert("QR Code tidak dapat dibaca. Format salah.");
        }
    }

    // --- 5. Form Logic & Manual Entry ---
    const inputArea = document.getElementById('input-area');
    const inputPeralatan = document.getElementById('input-peralatan');
    const inputKondisi = document.getElementById('input-kondisi');
    const inputCatatan = document.getElementById('input-catatan');
    const form = document.getElementById('inspection-form');
    const btnCancel = document.getElementById('btn-cancel-form');
    const submitLoading = document.getElementById('submit-loading');

    // Corrective Form Elements
    const correctiveArea = document.getElementById('corrective-area');
    const correctivePeralatan = document.getElementById('corrective-peralatan');
    const correctiveTanggal = document.getElementById('corrective-tanggal');
    const correctiveMasalah = document.getElementById('corrective-masalah');
    const correctiveTindakan = document.getElementById('corrective-tindakan');
    const correctiveStatus = document.getElementById('corrective-status');
    const correctivePic = document.getElementById('corrective-pic');
    const correctiveForm = document.getElementById('corrective-form');
    const btnCancelCorrective = document.getElementById('btn-cancel-corrective');
    const correctiveSubmitLoading = document.getElementById('corrective-submit-loading');

    // Manual Action Cards from Dashboard
    const btnManualPreventive = document.getElementById('btn-manual-preventive');
    const btnManualCorrective = document.getElementById('btn-manual-corrective');

    // Populate Area Dropdown for both forms
    Object.keys(lvmdpData).forEach(area => {
        const option1 = document.createElement('option');
        option1.value = area;
        option1.textContent = area;
        inputArea.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = area;
        option2.textContent = area;
        if (correctiveArea) correctiveArea.appendChild(option2);
    });

    // Handle Area Change for Preventive Form
    inputArea.addEventListener('change', (e) => {
        const selectedArea = e.target.value;
        inputPeralatan.innerHTML = '<option value="">-- Pilih Gardu/Panel --</option>'; // Reset

        if (selectedArea && lvmdpData[selectedArea]) {
            inputPeralatan.disabled = false;
            lvmdpData[selectedArea].forEach(panel => {
                const option = document.createElement('option');
                option.value = panel;
                option.textContent = panel;
                inputPeralatan.appendChild(option);
            });
        } else {
            inputPeralatan.disabled = true;
        }
    });

    // Handle Area Change for Corrective Form
    if (correctiveArea) {
        correctiveArea.addEventListener('change', (e) => {
            const selectedArea = e.target.value;
            correctivePeralatan.innerHTML = '<option value="">-- Pilih Gardu/Panel --</option>'; // Reset

            if (selectedArea && lvmdpData[selectedArea]) {
                correctivePeralatan.disabled = false;
                lvmdpData[selectedArea].forEach(panel => {
                    const option = document.createElement('option');
                    option.value = panel;
                    option.textContent = panel;
                    correctivePeralatan.appendChild(option);
                });
            } else {
                correctivePeralatan.disabled = true;
            }
        });
    }

    // Auto set dates to today
    const inputTanggal = document.getElementById('input-tanggal');
    const today = new Date().toISOString().split('T')[0];
    if (inputTanggal) inputTanggal.value = today;
    if (correctiveTanggal) correctiveTanggal.value = today;

    // Handle Dashboard Action Cards
    if (btnManualPreventive) {
        btnManualPreventive.addEventListener('click', () => {
            form.reset();
            inputArea.value = "";
            inputPeralatan.innerHTML = '<option value="">-- Pilih Gardu/Panel --</option>';
            inputPeralatan.disabled = true;
            inputCatatan.removeAttribute('required');
            const labelCatatan = document.getElementById('label-catatan');
            if (labelCatatan) labelCatatan.innerHTML = 'Catatan';
            inputTanggal.value = today;
            location.hash = '#form-view';
        });
    }

    if (btnManualCorrective) {
        btnManualCorrective.addEventListener('click', () => {
            if (correctiveForm) correctiveForm.reset();
            if (correctiveArea) correctiveArea.value = "";
            if (correctivePeralatan) {
                correctivePeralatan.innerHTML = '<option value="">-- Pilih Gardu/Panel --</option>';
                correctivePeralatan.disabled = true;
            }
            if (correctiveTanggal) correctiveTanggal.value = today;
            location.hash = '#corrective-form-view';
        });
    }

    // Helper to Prefill Forms
    function showForm(prefillArea, prefillPeralatan) {
        if (prefillArea && prefillPeralatan) {
            inputArea.value = prefillArea;
            inputArea.dispatchEvent(new Event('change'));
            inputPeralatan.value = prefillPeralatan;
        }
        location.hash = '#form-view';
    }

    function showCorrectiveForm(prefillArea, prefillPeralatan) {
        if (prefillArea && prefillPeralatan && correctiveArea) {
            correctiveArea.value = prefillArea;
            correctiveArea.dispatchEvent(new Event('change'));
            correctivePeralatan.value = prefillPeralatan;
        }
        location.hash = '#corrective-form-view';
    }

    // Cancel buttons
    btnCancel.addEventListener('click', () => {
        location.hash = '#dashboard';
        form.reset();
        inputCatatan.removeAttribute('required');
        const labelCatatan = document.getElementById('label-catatan');
        if (labelCatatan) labelCatatan.innerHTML = 'Catatan';
        inputTanggal.value = today;
    });

    if (btnCancelCorrective) {
        btnCancelCorrective.addEventListener('click', () => {
            location.hash = '#dashboard';
            if (correctiveForm) correctiveForm.reset();
            if (correctiveTanggal) correctiveTanggal.value = today;
        });
    }

    inputKondisi.addEventListener('change', (e) => {
        const labelCatatan = document.getElementById('label-catatan');
        if (e.target.value === 'Normal dengan catatan') {
            inputCatatan.setAttribute('required', 'true');
            labelCatatan.innerHTML = 'Catatan <span style="color:#f87171">* (Wajib)</span>';
        } else {
            inputCatatan.removeAttribute('required');
            labelCatatan.innerHTML = 'Catatan';
        }
    });

    // Preventive Form Submit Handler
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const gasUrl = getGasUrl();
        const formData = new FormData(form);
        const dataObj = {};
        
        formData.forEach((value, key) => {
            if (key === 'Tanggal' && value) {
                const parts = value.split('-');
                if (parts.length === 3) {
                    value = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
                }
            }
            dataObj[key] = value;
        });

        // Add explicit type
        dataObj["Tipe Laporan"] = "Preventive";

        // Save to History (local)
        addHistoryLog(dataObj["Gardu/Panel"], "Preventive", dataObj["Kondisi"], dataObj["PIC"]);

        // If offline, queue it!
        if (!navigator.onLine) {
            const queue = getOfflineQueue();
            queue.push({ type: 'Preventive', data: dataObj });
            saveOfflineQueue(queue);
            alert('Aplikasi sedang offline. Laporan disimpan secara lokal dan akan disinkronkan otomatis saat ada internet.');
            btnCancel.click();
            return;
        }

        // Online Submit
        const submitBtn = document.getElementById('btn-submit-form');
        submitBtn.disabled = true;
        submitLoading.classList.remove('hidden');

        fetch(gasUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(dataObj)
        })
            .then(response => response.json())
            .then(data => {
                if (data.result === 'success') {
                    alert('Data berhasil disimpan ke Google Sheets!');
                    btnCancel.click();
                } else {
                    alert('Gagal menyimpan: ' + data.error);
                }
            })
            .catch(err => {
                console.error(err);
                // If fetch fails (network issue), queue it!
                const queue = getOfflineQueue();
                queue.push({ type: 'Preventive', data: dataObj });
                saveOfflineQueue(queue);
                alert('Gagal mengirim karena masalah jaringan. Laporan disimpan secara lokal.');
                btnCancel.click();
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitLoading.classList.add('hidden');
            });
    });

    // Corrective Form Submit Handler
    if (correctiveForm) {
        correctiveForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const gasUrl = getGasUrl();
            const formData = new FormData(correctiveForm);
            const dataObj = {};
            
            formData.forEach((value, key) => {
                if (key === 'Tanggal' && value) {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                        value = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
                    }
                }
                dataObj[key] = value;
            });

            // Set report type
            dataObj["Tipe Laporan"] = "Corrective";

            // Add history
            addHistoryLog(dataObj["Gardu/Panel"], "Corrective", dataObj["Status Perbaikan"], dataObj["PIC"]);

            // If offline, queue it!
            if (!navigator.onLine) {
                const queue = getOfflineQueue();
                queue.push({ type: 'Corrective', data: dataObj });
                saveOfflineQueue(queue);
                alert('Aplikasi sedang offline. Laporan corrective disimpan secara lokal.');
                if (btnCancelCorrective) btnCancelCorrective.click();
                return;
            }

            // Online submit
            const submitBtn = document.getElementById('btn-submit-corrective');
            if (submitBtn) submitBtn.disabled = true;
            if (correctiveSubmitLoading) correctiveSubmitLoading.classList.remove('hidden');

            fetch(gasUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(dataObj)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.result === 'success') {
                        alert('Laporan corrective berhasil disimpan ke Google Sheets!');
                        if (btnCancelCorrective) btnCancelCorrective.click();
                    } else {
                        alert('Gagal menyimpan: ' + data.error);
                    }
                })
                .catch(err => {
                    console.error(err);
                    // Network failure, queue it
                    const queue = getOfflineQueue();
                    queue.push({ type: 'Corrective', data: dataObj });
                    saveOfflineQueue(queue);
                    alert('Gagal mengirim karena masalah jaringan. Laporan corrective disimpan secara lokal.');
                    if (btnCancelCorrective) btnCancelCorrective.click();
                })
                .finally(() => {
                    if (submitBtn) submitBtn.disabled = false;
                    if (correctiveSubmitLoading) correctiveSubmitLoading.classList.add('hidden');
                });
        });
    }

    // --- Offline Queue Management ---
    function getOfflineQueue() {
        try {
            return JSON.parse(localStorage.getItem('lvmdp_offline_queue')) || [];
        } catch(e) {
            return [];
        }
    }

    function saveOfflineQueue(queue) {
        localStorage.setItem('lvmdp_offline_queue', JSON.stringify(queue));
        updateOfflineBanner();
    }

    const offlineSyncBanner = document.getElementById('offline-sync-banner');
    const offlineCountText = document.getElementById('offline-count-text');
    const btnSyncNow = document.getElementById('btn-sync-now');

    function updateOfflineBanner() {
        if (!offlineSyncBanner) return;
        const queue = getOfflineQueue();
        if (queue.length > 0) {
            if (offlineCountText) offlineCountText.textContent = queue.length;
            offlineSyncBanner.classList.remove('hidden');
        } else {
            offlineSyncBanner.classList.add('hidden');
        }
    }

    let isSyncing = false;
    async function syncOfflineQueue() {
        if (isSyncing) return;
        const queue = getOfflineQueue();
        if (queue.length === 0) return;

        const gasUrl = getGasUrl();
        if (!gasUrl) {
            alert('URL Web App Google Sheets belum diatur.');
            return;
        }

        isSyncing = true;
        if (btnSyncNow) {
            btnSyncNow.disabled = true;
            btnSyncNow.textContent = 'Menyinkronkan...';
        }

        let successCount = 0;
        const remainingQueue = [...queue];

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            try {
                const response = await fetch(gasUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify(item.data)
                });
                const resData = await response.json();
                if (resData.result === 'success') {
                    successCount++;
                    // Remove from temporary remaining queue
                    remainingQueue.shift();
                } else {
                    console.error('Sync failed for item:', resData.error);
                    break;
                }
            } catch (err) {
                console.error('Network error during sync:', err);
                break;
            }
        }

        saveOfflineQueue(remainingQueue);
        isSyncing = false;
        
        if (btnSyncNow) {
            btnSyncNow.disabled = false;
            btnSyncNow.textContent = 'Sinkronkan';
        }

        if (successCount > 0) {
            alert(`${successCount} laporan offline berhasil disinkronkan ke Google Sheets!`);
            renderHistoryLogs();
        } else {
            alert('Gagal menyinkronkan laporan offline. Silakan periksa koneksi internet Anda.');
        }
    }

    if (btnSyncNow) {
        btnSyncNow.addEventListener('click', syncOfflineQueue);
    }

    window.addEventListener('online', () => {
        // Auto sync when back online
        setTimeout(syncOfflineQueue, 2000);
    });

    // --- History Logs Management ---
    function getHistoryLogs() {
        try {
            return JSON.parse(localStorage.getItem('lvmdp_history_logs')) || [];
        } catch(e) {
            return [];
        }
    }

    function addHistoryLog(panel, type, status, pic) {
        const logs = getHistoryLogs();
        const now = new Date();
        const timeStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        const newLog = {
            time: timeStr,
            panel: panel,
            type: type,
            status: status,
            pic: pic
        };

        logs.unshift(newLog); // Prepend
        const trimmedLogs = logs.slice(0, 10); // Keep last 10
        localStorage.setItem('lvmdp_history_logs', JSON.stringify(trimmedLogs));
        renderHistoryLogs();
    }

    function renderHistoryLogs() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        const logs = getHistoryLogs();
        if (logs.length === 0) {
            historyList.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-light);">Belum ada riwayat laporan di perangkat ini.</td>
                </tr>
            `;
            return;
        }

        historyList.innerHTML = '';
        logs.forEach(log => {
            let badgeClass = 'normal';
            if (log.status === 'Abnormal') badgeClass = 'abnormal';
            else if (log.status === 'Normal dengan catatan') badgeClass = 'warning';
            else if (log.status === 'Closed') badgeClass = 'normal';
            else if (log.status === 'Open') badgeClass = 'abnormal';
            else if (log.status === 'Progress') badgeClass = 'warning';
            else if (log.status && log.status.startsWith('Corrective')) badgeClass = 'corrective';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px 8px; color: var(--text-light);">${log.time}</td>
                <td style="padding: 12px 8px; font-weight: 500;">${log.panel}</td>
                <td style="padding: 12px 8px;">
                    <span class="status-badge ${log.type === 'Corrective' ? 'corrective' : 'normal'}" style="font-size: 0.75rem;">
                        ${log.type}
                    </span>
                </td>
                <td style="padding: 12px 8px;">
                    <span class="status-badge ${badgeClass}" style="font-size: 0.75rem;">
                        ${log.status}
                    </span>
                </td>
                <td style="padding: 12px 8px; color: var(--text-light);">${log.pic}</td>
            `;
            historyList.appendChild(tr);
        });
    }

    // --- Scan Choice Modal Logic ---
    const scanChoiceModal = document.getElementById('scan-choice-modal');
    const modalAreaName = document.getElementById('modal-area-name');
    const modalPanelName = document.getElementById('modal-panel-name');
    const btnModalPreventive = document.getElementById('btn-modal-preventive');
    const btnModalCorrective = document.getElementById('btn-modal-corrective');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    let scannedArea = '';
    let scannedPanel = '';

    function showScanChoiceModal(area, panel) {
        if (!scanChoiceModal) return;
        scannedArea = area;
        scannedPanel = panel;
        
        if (modalAreaName) modalAreaName.textContent = area;
        if (modalPanelName) modalPanelName.textContent = panel;
        
        scanChoiceModal.classList.remove('hidden');
    }

    function hideScanChoiceModal() {
        if (scanChoiceModal) scanChoiceModal.classList.add('hidden');
    }

    if (btnModalPreventive) {
        btnModalPreventive.addEventListener('click', () => {
            hideScanChoiceModal();
            showForm(scannedArea, scannedPanel);
        });
    }

    if (btnModalCorrective) {
        btnModalCorrective.addEventListener('click', () => {
            hideScanChoiceModal();
            showCorrectiveForm(scannedArea, scannedPanel);
        });
    }

    if (btnModalCancel) {
        btnModalCancel.addEventListener('click', () => {
            hideScanChoiceModal();
            location.hash = '#dashboard';
        });
    }

    // --- 6. Initial Page Load Rendering ---
    renderHistoryLogs();
    updateOfflineBanner();

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
