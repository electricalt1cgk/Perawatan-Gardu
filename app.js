document.addEventListener('DOMContentLoaded', () => {
    // --- 1. View Routing & Navigation ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const views = document.querySelectorAll('.view');
    let html5QrcodeScanner = null;

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // Update Active Link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

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
                document.getElementById('form-section').classList.add('hidden');
                document.querySelector('.scanner-container').classList.remove('hidden');
            }

            // Handle Generator initialization
            if (targetId === 'generator') {
                initGenerator();
            }
        });
    });

    // --- 2. Settings Management ---
    const GAS_URL_KEY = 'lvmdp_gas_url';
    const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzQ-juLMbcymH_D-6tCLTGLIEWkNRXyyoH_OUzi4qystZnnMaDIT3ilDTA8Ujw98IiB/exec';
    const inputGasUrl = document.getElementById('input-gas-url');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    // Load saved URL
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
    let isGeneratorInit = false;

    function initGenerator() {
        if (isGeneratorInit) return; // Prevent re-rendering
        
        // Populate Filter
        Object.keys(lvmdpData).forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaFilter.appendChild(option);
        });

        renderQRCodes('ALL');
        isGeneratorInit = true;

        areaFilter.addEventListener('change', (e) => {
            renderQRCodes(e.target.value);
        });
    }

    function renderQRCodes(filterArea) {
        qrListContainer.innerHTML = '';
        Object.keys(lvmdpData).forEach(area => {
            if (filterArea === 'ALL' || filterArea === area) {
                lvmdpData[area].forEach(peralatan => {
                    createQRLabel(area, peralatan);
                });
            }
        });
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

        // Encode data as JSON
        const qrData = JSON.stringify({ a: area, p: peralatan });

        new QRCode(qrDiv, {
            text: qrData,
            width: 128,
            height: 128,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });
    }

    // --- 4. Scanner Logic ---
    function initScanner() {
        const scannerStatus = document.getElementById('scanner-status');
        if (html5QrcodeScanner) return; // Already running

        // Setup Html5Qrcode
        html5QrcodeScanner = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        scannerStatus.textContent = "Mencari kamera...";
        
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
                let cameraId = devices[0].id;
                // Try to get back camera
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
                    (errorMessage) => {
                        // ignore scan errors, it throws them constantly while searching
                    })
                .then(() => {
                    scannerStatus.textContent = "Arahkan kamera ke QR Code";
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
            }).catch(err => {
                console.error("Failed to stop scanner", err);
            });
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        try {
            const data = JSON.parse(decodedText);
            if (data.a && data.p) {
                // Play success beep if available
                if ('vibrate' in navigator) navigator.vibrate(200);

                stopScanner();
                showForm(data.a, data.p);
            } else {
                alert("QR Code tidak valid untuk aplikasi ini.");
            }
        } catch (e) {
            alert("QR Code tidak dapat dibaca. Format salah.");
        }
    }

    // --- 5. Form Logic ---
    const formSection = document.getElementById('form-section');
    const scannerContainer = document.querySelector('.scanner-container');
    const inputArea = document.getElementById('input-area');
    const inputPeralatan = document.getElementById('input-peralatan');
    const inputKondisi = document.getElementById('input-kondisi');
    const noteGroup = document.getElementById('note-group');
    const inputCatatan = document.getElementById('input-catatan');
    const form = document.getElementById('inspection-form');
    const btnCancel = document.getElementById('btn-cancel-form');
    const submitLoading = document.getElementById('submit-loading');

    // Auto set date to today
    const inputTanggal = document.getElementById('input-tanggal');
    const today = new Date().toISOString().split('T')[0];
    inputTanggal.value = today;

    function showForm(area, peralatan) {
        scannerContainer.classList.add('hidden');
        formSection.classList.remove('hidden');
        inputArea.value = area;
        inputPeralatan.value = peralatan;
    }

    btnCancel.addEventListener('click', () => {
        formSection.classList.add('hidden');
        scannerContainer.classList.remove('hidden');
        form.reset();
        inputCatatan.removeAttribute('required');
        inputTanggal.value = today;
        initScanner();
    });

    inputKondisi.addEventListener('change', (e) => {
        const labelCatatan = document.getElementById('label-catatan');
        if (e.target.value === 'Normal dengan catatan') {
            inputCatatan.setAttribute('required', 'true');
            labelCatatan.innerHTML = 'Catatan <span style="color:red">* (Wajib)</span>';
        } else {
            inputCatatan.removeAttribute('required');
            labelCatatan.innerHTML = 'Catatan';
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const gasUrl = getGasUrl();
        if (!gasUrl) {
            alert('URL Web App Google Sheets belum diatur. Silakan ke menu Settings terlebih dahulu.');
            return;
        }

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

        // UI Loading State
        const submitBtn = document.getElementById('btn-submit-form');
        submitBtn.disabled = true;
        submitLoading.classList.remove('hidden');

        // Send to GAS
        fetch(gasUrl, {
            method: 'POST',
            // Sending as plain text to avoid complex CORS preflight issues with Google Apps Script
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(dataObj)
        })
        .then(response => response.json())
        .then(data => {
            if (data.result === 'success') {
                alert('Data berhasil disimpan ke Google Sheets!');
                btnCancel.click(); // Reset and back to scanner
            } else {
                alert('Gagal menyimpan: ' + data.error);
            }
        })
        .catch(err => {
            console.error(err);
            alert('Terjadi kesalahan saat mengirim data. Pastikan URL benar dan internet aktif.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitLoading.classList.add('hidden');
        });
    });

});
