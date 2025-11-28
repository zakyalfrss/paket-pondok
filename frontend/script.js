// =============================================
// SISTEM MANAJEMEN PAKET PONDOK - FRONTEND JAVASCRIPT
// Complete fixed version - All tabs working
// =============================================

// Konfigurasi
const API_BASE_URL = "/api";
let kobongData = [];
let barangData = [];
let isProcessing = false;
let qrPollingInterval;

// =============================================
// INITIALIZATION WITH TAB FIX
// =============================================

document.addEventListener("DOMContentLoaded", function () {
    console.log('🚀 Initializing application...');
    
    // Pastikan tab input aktif saat pertama kali load
    setTimeout(() => {
        const inputTab = document.getElementById('input');
        const inputButton = document.querySelector('.tab-button[onclick*="input"]');
        
        if (inputTab && !inputTab.classList.contains('active')) {
            inputTab.classList.add('active');
        }
        if (inputButton && !inputButton.classList.contains('active')) {
            inputButton.classList.add('active');
        }
        
        debugTabs();
    }, 100);
    
    initializeApp();
    setupFormEventListeners(); // Ini akan setup semua filter termasuk penerima
    startQRPolling();
    setInterval(updateSystemStatus, 30000);
});

async function initializeApp() {
    try {
        await loadPenerimaData();
        await loadBarangData();
        await loadLogData();
        updateSystemStatus();
        updateStats();
        toggleReportFields();
        
        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showAlert('Gagal memulai aplikasi: ' + error.message, 'error');
    }
}

function setupFormEventListeners() {
    console.log('🔧 Setting up form event listeners...');
    
    // Event listener untuk form input paket
    const jenisKelaminSelect = document.getElementById("jenis_kelamin");
    const tipePenerimaSelect = document.getElementById("tipe_penerima");
    const penerimaSelect = document.getElementById("penerima");
    const jenisBarangSelect = document.getElementById("jenis_barang");
    
    if (jenisKelaminSelect) {
        jenisKelaminSelect.addEventListener("change", loadTipePenerima);
    }
    if (tipePenerimaSelect) {
        tipePenerimaSelect.addEventListener("change", loadPenerimaOptions);
    }
    if (penerimaSelect) {
        penerimaSelect.addEventListener("change", handlePenerimaChange);
    }
    if (jenisBarangSelect) {
        // Tidak perlu tambahkan event listener lagi karena sudah ada onchange di HTML
    }
    
    // Form submission
    const formPaket = document.getElementById('form-paket');
    const formPenerima = document.getElementById('form-penerima');
    
    if (formPaket) {
        formPaket.addEventListener('submit', handlePaketSubmit);
    }
    if (formPenerima) {
        formPenerima.addEventListener('submit', handlePenerimaSubmit);
    }
    
    // Filter events untuk daftar paket
    setupBarangFilters();
    
    // Filter events untuk data penerima
    setupPenerimaFilters();
    
    console.log('✅ Form event listeners setup complete');
}

// =============================================
// TAB MANAGEMENT FUNCTIONS
// =============================================

function openTab(tabName, event) {
    console.log('🔄 Opening tab:', tabName);
    
    // Sembunyikan semua tab content
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    // Non-aktifkan semua tab buttons
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active");
    }

    // Tampilkan tab yang dipilih
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add("active");
        console.log(`✅ Tab ${tabName} activated`);
    }
    
    // Aktifkan button yang dipilih
    if (event && event.currentTarget) {
        event.currentTarget.classList.add("active");
    }

    // Load data sesuai tab
    switch(tabName) {
        case "daftar":
            loadBarangData();
            break;
        case "data-penerima":
            loadPenerimaData();
            break;
        case "log":
            loadLogData();
            break;
        case "laporan":
            updateStats();
            break;
    }
}

// =============================================
// DEBUG FUNCTION TO CHECK TABS
// =============================================

function debugTabs() {
    console.log('🔍 Debugging tabs...');
    
    const tabs = ['input', 'daftar', 'data-penerima', 'log', 'laporan'];
    
    tabs.forEach(tab => {
        const element = document.getElementById(tab);
        const isActive = element ? element.classList.contains('active') : false;
        console.log(`Tab ${tab}:`, element ? `Found (active: ${isActive})` : 'NOT FOUND');
    });
    
    // Cek tombol tab
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log(`Found ${tabButtons.length} tab buttons`);
    
    tabButtons.forEach((button, index) => {
        const isActive = button.classList.contains('active');
        console.log(`Button ${index}: "${button.textContent.trim()}" (active: ${isActive})`);
    });
}

// =============================================
// PENERIMA MANAGEMENT
// =============================================

async function loadTipePenerima() {
    if (isProcessing) {
        console.log('⏳ Skip - already processing');
        return;
    }
    
    isProcessing = true;
    const jenisKelamin = document.getElementById("jenis_kelamin").value;
    const tipePenerimaSelect = document.getElementById("tipe_penerima");
    
    console.log(`🔄 Loading tipe penerima for: ${jenisKelamin}`);
    
    try {
        if (!jenisKelamin) {
            tipePenerimaSelect.innerHTML = '<option value="">Pilih Tipe Penerima</option>';
            tipePenerimaSelect.disabled = true;
            resetPenerimaForm();
            return;
        }
        
        tipePenerimaSelect.disabled = false;
        
        // Load semua penerima untuk mendapatkan role yang tersedia
        const response = await fetch(`${API_BASE_URL}/kobong`);
        if (!response.ok) throw new Error('Gagal memuat data penerima');
        
        const semuaPenerima = await response.json();
        
        // Filter role unik berdasarkan jenis kelamin
        const roles = [...new Set(semuaPenerima
            .filter(p => p.jenis_kelamin === jenisKelamin)
            .map(p => p.role)
        )].sort();
        
        console.log(`📋 Available roles for ${jenisKelamin}:`, roles);
        
        // Tambahkan opsi santri
        const allRoles = [...roles, 'santri'];
        
        tipePenerimaSelect.innerHTML = '<option value="">Pilih Tipe Penerima</option>' +
            allRoles.map(role => 
                `<option value="${role}">${formatRoleName(role)}</option>`
            ).join('');
            
        resetPenerimaForm();
            
    } catch (error) {
        console.error('Error loading roles:', error);
        // Fallback ke default roles
        const defaultRoles = ['pembimbing', 'pengasuh', 'takhosus', 'pegawai', 'santri'];
        tipePenerimaSelect.innerHTML = '<option value="">Pilih Tipe Penerima</option>' +
            defaultRoles.map(role => 
                `<option value="${role}">${formatRoleName(role)}</option>`
            ).join('');
    } finally {
        isProcessing = false;
    }
}

async function loadPenerimaOptions() {
    if (isProcessing) {
        console.log('⏳ Skip - already processing');
        return;
    }
    
    isProcessing = true;
    const jenisKelamin = document.getElementById("jenis_kelamin").value;
    const tipePenerima = document.getElementById("tipe_penerima").value;
    const penerimaSelect = document.getElementById("penerima");
    
    console.log(`🔄 Loading penerima options: ${jenisKelamin} - ${tipePenerima}`);
    
    try {
        resetPenerimaForm();
        
        if (!jenisKelamin || !tipePenerima) {
            penerimaSelect.innerHTML = '<option value="">Pilih jenis kelamin dan tipe</option>';
            return;
        }
        
        penerimaSelect.innerHTML = '<option value="">Memuat data...</option>';
        
        if (tipePenerima === 'santri') {
            // Untuk santri, load pembimbing
            document.getElementById("form-santri").style.display = 'block';
            
            const response = await fetch(`${API_BASE_URL}/kobong/${jenisKelamin}/pembimbing`);
            if (!response.ok) throw new Error('Gagal memuat data pembimbing');
            
            const pembimbing = await response.json();
            console.log(`📋 Pembimbing found:`, pembimbing);
            
            if (pembimbing.length === 0) {
                penerimaSelect.innerHTML = '<option value="">Tidak ada pembimbing</option>';
                showAlert(`Tidak ada pembimbing ${jenisKelamin}`, 'warning');
            } else {
                penerimaSelect.innerHTML = '<option value="">Pilih Pembimbing</option>' +
                    pembimbing.map(p => 
                        `<option value="${p.id_kobong}" data-nama="${p.nama_pembimbing}" data-kamar="${p.nama_kamar}" data-nowa="${p.no_wa}">
                            ${p.nama_pembimbing} - ${p.nama_kamar}
                        </option>`
                    ).join('');
            }
        } else {
            // Untuk non-santri, load berdasarkan role
            document.getElementById("form-santri").style.display = 'none';
            
            const response = await fetch(`${API_BASE_URL}/kobong/${jenisKelamin}/${tipePenerima}`);
            if (!response.ok) throw new Error('Gagal memuat data penerima');
            
            const penerima = await response.json();
            console.log(`📋 Penerima found:`, penerima);
            
            if (penerima.length === 0) {
                penerimaSelect.innerHTML = '<option value="">Tidak ada data penerima</option>';
                showAlert(`Tidak ada data ${formatRoleName(tipePenerima)} ${jenisKelamin}`, 'warning');
            } else {
                penerimaSelect.innerHTML = '<option value="">Pilih Penerima</option>' +
                    penerima.map(p => 
                        `<option value="${p.id_kobong}" data-nama="${p.nama_pembimbing}" data-kamar="${p.nama_kamar}" data-nowa="${p.no_wa}">
                            ${p.nama_pembimbing} - ${p.nama_kamar}
                        </option>`
                    ).join('');
            }
        }
    } catch (error) {
        console.error('Error loading penerima:', error);
        penerimaSelect.innerHTML = '<option value="">Error memuat data</option>';
        showAlert('Gagal memuat data penerima: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

function handlePenerimaChange(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const penerimaInfo = document.getElementById("penerima-info");
    const tipePenerima = document.getElementById("tipe_penerima").value;
    
    if (selectedOption.value && selectedOption.dataset.nama && tipePenerima !== 'santri') {
        penerimaInfo.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-user" style="color: #4caf50;"></i>
                <div>
                    <strong style="display: block;">${selectedOption.dataset.nama}</strong>
                    <small style="color: #666;">
                        Kamar: ${selectedOption.dataset.kamar} | 
                        WA: ${selectedOption.dataset.nowa}
                    </small>
                </div>
            </div>
        `;
        penerimaInfo.style.display = 'block';
    } else {
        penerimaInfo.style.display = 'none';
    }
}

function resetPenerimaForm() {
    const penerimaSelect = document.getElementById("penerima");
    const formSantri = document.getElementById("form-santri");
    const penerimaInfo = document.getElementById("penerima-info");
    const namaSantri = document.getElementById("nama_santri");
    
    if (penerimaSelect) penerimaSelect.innerHTML = '<option value="">Pilih Tipe terlebih dahulu</option>';
    if (formSantri) formSantri.style.display = 'none';
    if (penerimaInfo) penerimaInfo.style.display = 'none';
    if (namaSantri) namaSantri.value = '';
}
// =============================================
// FILTER FUNCTIONS UNTUK DATA PENERIMA
// =============================================

function setupPenerimaFilters() {
    const filterJenisKelamin = document.getElementById('filter-penerima-jenis-kelamin');
    const filterRole = document.getElementById('filter-penerima-role');
    
    if (filterJenisKelamin) {
        filterJenisKelamin.addEventListener('change', applyPenerimaFilters);
    }
    if (filterRole) {
        filterRole.addEventListener('change', applyPenerimaFilters);
    }
}

function applyPenerimaFilters() {
    const filterJenisKelamin = document.getElementById('filter-penerima-jenis-kelamin').value;
    const filterRole = document.getElementById('filter-penerima-role').value;
    
    console.log('🔍 Applying filters:', { 
        jenisKelamin: filterJenisKelamin, 
        role: filterRole 
    });
    
    let filteredData = kobongData;
    
    // Filter berdasarkan jenis kelamin
    if (filterJenisKelamin) {
        filteredData = filteredData.filter(penerima => 
            penerima.jenis_kelamin === filterJenisKelamin
        );
    }
    
    // Filter berdasarkan role
    if (filterRole) {
        filteredData = filteredData.filter(penerima => 
            penerima.role === filterRole
        );
    }
    
    console.log(`📊 Filtered data: ${filteredData.length} dari ${kobongData.length} penerima`);
    displayPenerimaData(filteredData);
}

function displayPenerimaData(data) {
    const tbody = document.querySelector('#table-penerima tbody');
    if (!tbody) {
        console.error('❌ Tabel penerima tidak ditemukan');
        return;
    }
    
    console.log('🔄 Displaying penerima data:', data.length, 'items');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 10px;"></i>
                    <p>Tidak ada data penerima</p>
                    <p class="filter-message" style="font-size: 12px; margin-top: 5px;">
                        Coba ubah filter atau tambahkan penerima baru
                    </p>
                    <button onclick="showPenerimaForm()" class="btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Tambah Penerima
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((penerima, index) => {
        const row = document.createElement('tr');
        
        // Badge jenis kelamin
        const jenisKelaminBadge = penerima.jenis_kelamin === 'putra' 
            ? '<span class="badge-putra">PUTRA</span>'
            : '<span class="badge-putri">PUTRI</span>';
        
        // Badge role dengan class sesuai role
        const roleBadge = `<span class="role-badge ${penerima.role}">${formatRoleName(penerima.role)}</span>`;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <strong>${penerima.nama_pembimbing}</strong>
            </td>
            <td>${penerima.nama_kamar}</td>
            <td>${jenisKelaminBadge}</td>
            <td>${roleBadge}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="fab fa-whatsapp" style="color: #25D366;"></i>
                    ${penerima.no_wa}
                </div>
            </td>
            <td class="action-buttons">
                <button onclick="editPenerima(${penerima.id_kobong})" class="btn-small btn-edit">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deletePenerima(${penerima.id_kobong})" class="btn-small btn-delete">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('✅ Data penerima ditampilkan di tabel');
}

// =============================================
// FILTER FUNCTIONS UNTUK DAFTAR PAKET
// =============================================

function setupBarangFilters() {
    const filterStatus = document.getElementById('filter-status');
    const filterJenisKelamin = document.getElementById('filter-jenis-kelamin');
    const filterJenisBarang = document.getElementById('filter-jenis-barang');
    
    if (filterStatus) {
        filterStatus.addEventListener('change', applyBarangFilters);
    }
    if (filterJenisKelamin) {
        filterJenisKelamin.addEventListener('change', applyBarangFilters);
    }
    if (filterJenisBarang) {
        filterJenisBarang.addEventListener('change', applyBarangFilters);
    }
}

function applyBarangFilters() {
    const filterStatus = document.getElementById('filter-status').value;
    const filterJenisKelamin = document.getElementById('filter-jenis-kelamin').value;
    const filterJenisBarang = document.getElementById('filter-jenis-barang').value;
    
    console.log('🔍 Applying barang filters:', { 
        status: filterStatus, 
        jenisKelamin: filterJenisKelamin,
        jenisBarang: filterJenisBarang
    });
    
    let filteredData = barangData;
    
    // Filter berdasarkan status
    if (filterStatus) {
        filteredData = filteredData.filter(barang => 
            barang.status === filterStatus
        );
    }
    
    // Filter berdasarkan jenis kelamin
    if (filterJenisKelamin) {
        filteredData = filteredData.filter(barang => 
            barang.jenis_kelamin_penerima === filterJenisKelamin
        );
    }
    
    // Filter berdasarkan jenis barang
    if (filterJenisBarang) {
        filteredData = filteredData.filter(barang => 
            barang.jenis_barang === filterJenisBarang
        );
    }
    
    console.log(`📦 Filtered data: ${filteredData.length} dari ${barangData.length} paket`);
    displayBarangData(filteredData);
}

// Function untuk update opsi filter jenis barang berdasarkan data yang ada
function updateJenisBarangFilterOptions() {
    const filterJenisBarang = document.getElementById('filter-jenis-barang');
    if (!filterJenisBarang) return;
    
    // Ambil semua jenis barang unik dari data
    const semuaJenisBarang = [...new Set(barangData.map(barang => barang.jenis_barang))].sort();
    
    // Simpan opsi yang sudah ada (Semua Jenis Barang + predefined)
    const existingOptions = filterJenisBarang.innerHTML;
    
    // Tambahkan opsi custom yang ada di data
    let customOptions = '';
    semuaJenisBarang.forEach(jenis => {
        // Jika jenis barang tidak ada di predefined options, tambahkan
        if (!['Makanan', 'Minuman', 'Pakaian', 'Buku', 'Obat', 'Lainnya'].includes(jenis)) {
            customOptions += `<option value="${jenis}">${jenis}</option>`;
        }
    });
    
    // Update select dengan opsi custom
    filterJenisBarang.innerHTML = existingOptions + customOptions;
}

// Update loadBarangData untuk refresh filter options
async function loadBarangData() {
    try {
        console.log('📦 Loading data barang...');
        const response = await fetch(`${API_BASE_URL}/barang`);
        if (!response.ok) throw new Error('Gagal memuat data barang');
        
        barangData = await response.json();
        console.log(`✅ Loaded ${barangData.length} barang`);
        
        // Update opsi filter jenis barang
        updateJenisBarangFilterOptions();
        
        applyBarangFilters();
    } catch (error) {
        console.error("Error loading barang data:", error);
        showAlert("Gagal memuat data paket", "error");
    }
}

// =============================================
// CUSTOM JENIS BARANG FUNCTIONS
// =============================================

function toggleCustomJenisBarang() {
    const jenisBarangSelect = document.getElementById('jenis_barang');
    const customContainer = document.getElementById('custom-jenis-barang-container');
    const customInput = document.getElementById('custom_jenis_barang');
    
    if (jenisBarangSelect.value === 'Lainnya') {
        customContainer.style.display = 'block';
        customInput.required = true;
    } else {
        customContainer.style.display = 'none';
        customInput.required = false;
        customInput.value = ''; // Reset value
    }
}

// =============================================
// FORM HANDLERS
// =============================================

async function handlePaketSubmit(e) {
    e.preventDefault();
    
    const jenisKelamin = document.getElementById('jenis_kelamin').value;
    const tipePenerima = document.getElementById('tipe_penerima').value;
    const penerimaSelect = document.getElementById('penerima');
    const namaSantri = document.getElementById('nama_santri').value;
    const jenisBarangSelect = document.getElementById('jenis_barang');
    const customJenisBarang = document.getElementById('custom_jenis_barang').value;
    
    // Validasi dasar
    if (!jenisKelamin || !tipePenerima || !penerimaSelect.value) {
        showAlert('Harap lengkapi semua field penerima', 'error');
        return;
    }
    
    if (tipePenerima === 'santri' && !namaSantri) {
        showAlert('Harap isi nama santri', 'error');
        return;
    }
    
    // Validasi jenis barang
    if (!jenisBarangSelect.value) {
        showAlert('Harap pilih jenis barang', 'error');
        return;
    }
    
    // Jika pilih Lainnya, harus isi custom jenis barang
    if (jenisBarangSelect.value === 'Lainnya' && !customJenisBarang.trim()) {
        showAlert('Harap isi jenis barang lainnya', 'error');
        return;
    }
    
    try {
        // Tentukan jenis barang yang akan disimpan
        let jenisBarangFinal = jenisBarangSelect.value;
        if (jenisBarangSelect.value === 'Lainnya' && customJenisBarang.trim()) {
            jenisBarangFinal = customJenisBarang.trim();
        }
        
        const formData = {
            id_kobong: tipePenerima === 'santri' ? penerimaSelect.value : penerimaSelect.value,
            nama_pengirim: document.getElementById('nama_pengirim').value,
            nama_penerima: tipePenerima === 'santri' ? namaSantri : penerimaSelect.options[penerimaSelect.selectedIndex].dataset.nama,
            jenis_barang: jenisBarangFinal, // Gunakan jenis barang yang sudah diproses
            kondisi: document.getElementById('kondisi').value,
            catatan: document.getElementById('catatan').value,
            jenis_kelamin_penerima: jenisKelamin
        };
        
        console.log('📦 Data paket yang akan disimpan:', formData);
        
        const response = await fetch(`${API_BASE_URL}/barang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Paket berhasil disimpan! Notifikasi WhatsApp terkirim', 'success');
            resetPaketForm();
            loadBarangData();
            loadLogData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving package:', error);
        showAlert('Gagal menyimpan paket: ' + error.message, 'error');
    }
}

async function handlePenerimaSubmit(e) {
    e.preventDefault();

    const formData = {
        nama_kamar: document.getElementById('penerima-kamar').value,
        nama_pembimbing: document.getElementById('penerima-nama').value,
        no_wa: document.getElementById('penerima-nowa').value,
        jenis_kelamin: document.getElementById('penerima-jenis-kelamin').value,
        role: document.getElementById('penerima-role').value
    };

    const penerimaId = document.getElementById('penerima-id').value;

    try {
        let response;
        if (penerimaId) {
            // Update existing
            response = await fetch(`${API_BASE_URL}/kobong/${penerimaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new
            response = await fetch(`${API_BASE_URL}/kobong`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }

        const result = await response.json();

        if (result.success) {
            showAlert(`Penerima berhasil ${penerimaId ? 'diupdate' : 'ditambahkan'}`, 'success');
            hidePenerimaForm();
            loadPenerimaData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving penerima:', error);
        showAlert('Gagal menyimpan penerima: ' + error.message, 'error');
    }
}

// =============================================
// RESET FORM PAKET FUNCTION
// =============================================

function resetPaketForm() {
    document.getElementById('form-paket').reset();
    resetPenerimaForm();
    
    // Reset custom jenis barang
    const customContainer = document.getElementById('custom-jenis-barang-container');
    const customInput = document.getElementById('custom_jenis_barang');
    
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
        customInput.value = '';
        customInput.required = false;
    }
}

// =============================================
// DATA LOADING FUNCTIONS
// =============================================

async function loadPenerimaData() {
    try {
        console.log('📋 Loading data penerima...');
        const response = await fetch(`${API_BASE_URL}/kobong`);
        if (!response.ok) throw new Error('Gagal memuat data penerima');
        
        kobongData = await response.json();
        console.log(`✅ Loaded ${kobongData.length} penerima`);
        applyPenerimaFilters(); // Gunakan filter untuk menampilkan data
    } catch (error) {
        console.error('Error loading penerima data:', error);
        showAlert('Gagal memuat data penerima: ' + error.message, 'error');
    }
}


function displayPenerimaData(data) {
    const tbody = document.querySelector('#table-penerima tbody');
    if (!tbody) {
        console.error('❌ Tabel penerima tidak ditemukan');
        return;
    }
    
    console.log('🔄 Displaying penerima data:', data.length, 'items');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 10px;"></i>
                    <p>Tidak ada data penerima</p>
                    <button onclick="showPenerimaForm()" class="btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Tambah Penerima Pertama
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((penerima, index) => {
        const row = document.createElement('tr');
        
        // Badge jenis kelamin
        const jenisKelaminBadge = penerima.jenis_kelamin === 'putra' 
            ? '<span class="badge-putra">PUTRA</span>'
            : '<span class="badge-putri">PUTRI</span>';
        
        // Badge role
        const roleBadge = `<span class="role-badge">${formatRoleName(penerima.role)}</span>`;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <strong>${penerima.nama_pembimbing}</strong>
            </td>
            <td>${penerima.nama_kamar}</td>
            <td>${jenisKelaminBadge}</td>
            <td>${roleBadge}</td>
            <td>${penerima.no_wa}</td>
            <td class="action-buttons">
                <button onclick="editPenerima(${penerima.id_kobong})" class="btn-small btn-edit">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deletePenerima(${penerima.id_kobong})" class="btn-small btn-delete">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('✅ Data penerima ditampilkan di tabel');
}

async function loadBarangData() {
    try {
        console.log('📦 Loading data barang...');
        const response = await fetch(`${API_BASE_URL}/barang`);
        if (!response.ok) throw new Error('Gagal memuat data barang');
        
        barangData = await response.json();
        console.log(`✅ Loaded ${barangData.length} barang`);
        applyBarangFilters(); // Gunakan filter untuk menampilkan data
    } catch (error) {
        console.error("Error loading barang data:", error);
        showAlert("Gagal memuat data paket", "error");
    }
}

function displayBarangData(data) {
    const tbody = document.querySelector("#table-paket tbody");
    if (!tbody) {
        console.error('❌ Tabel paket tidak ditemukan');
        return;
    }
    
    tbody.innerHTML = "";

    // Jika tidak ada data setelah filter
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px;"></i>
                    <p>Tidak ada data paket</p>
                    <p class="filter-message" style="font-size: 12px; margin-top: 5px;">
                        Coba ubah filter pencarian
                    </p>
                </td>
            </tr>
        `;
        return;
    }

    // Group by tanggal
    const groupedByDate = groupBarangByDate(data);
    
    let overallIndex = 1;
    
    // Loop melalui setiap hari
    Object.keys(groupedByDate).forEach(date => {
        const barangHariIni = groupedByDate[date];
        
        // Add header untuk hari
        const headerRow = document.createElement("tr");
        headerRow.className = "date-header";
        headerRow.innerHTML = `
            <td colspan="9" class="date-header-cell">
                <strong>📅 ${formatDateHeader(date)}</strong>
                <span class="item-count">(${barangHariIni.length} paket)</span>
            </td>
        `;
        tbody.appendChild(headerRow);
        
        // Add data paket untuk hari ini
        barangHariIni.forEach((barang, index) => {
            const row = document.createElement("tr");
            row.className = barang.status === 'diambil' ? 'taken-item' : '';
            
            const takenButton = barang.status !== 'diambil' 
                ? `<button onclick="updateStatus(${barang.id_barang}, 'diambil')" class="btn-small btn-taken">
                    <i class="fas fa-check"></i> Diambil
                  </button>`
                : '';

            // Tampilkan badge jenis kelamin
            const jenisKelaminBadge = barang.jenis_kelamin_penerima === 'putra' 
                ? '<span class="badge-putra">PUTRA</span>'
                : '<span class="badge-putri">PUTRI</span>';

            row.innerHTML = `
                <td>${overallIndex}</td>
                <td>
                    ${new Date(barang.tanggal_datang).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit"
                    })}
                </td>
                <td>${jenisKelaminBadge}</td>
                <td>
                    <strong>${barang.nama_penerima}</strong><br>
                    <small>${barang.nama_pembimbing || ''}</small>
                </td>
                <td>${barang.nama_pengirim}</td>
                <td>${barang.jenis_barang}</td>
                <td><span class="status-badge status-${barang.status}">${barang.status}</span></td>
                <td><span class="status-badge kondisi-${barang.kondisi}">${barang.kondisi}</span></td>
                <td class="action-buttons">
                    <button onclick="showDetail(${barang.id_barang})" class="btn-small btn-edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${takenButton}
                    <button onclick="deletePaket(${barang.id_barang})" class="btn-small btn-delete">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;

            tbody.appendChild(row);
            overallIndex++;
        });
    });
}

async function loadLogData() {
    try {
        const response = await fetch(`${API_BASE_URL}/log`);
        const logData = await response.json();
        displayLogData(logData);
    } catch (error) {
        console.error("Error loading log data:", error);
    }
}

function displayLogData(data) {
    const tbody = document.querySelector("#table-log tbody");
    if (!tbody) {
        console.error('❌ Tabel log tidak ditemukan');
        return;
    }
    
    tbody.innerHTML = "";

    data.forEach((log) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${new Date(log.waktu).toLocaleString("id-ID")}</td>
            <td>${log.aksi}</td>
            <td>${log.deskripsi}</td>
            <td>${log.nama_penerima || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

// =============================================
// CRUD OPERATIONS
// =============================================

async function updateStatus(id_barang, status) {
    if (!confirm("Apakah Anda yakin ingin mengubah status paket?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/barang/${id_barang}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });

        const result = await response.json();

        if (result.success) {
            showAlert("Status paket berhasil diubah! Notifikasi WhatsApp terkirim", "success");
            loadBarangData();
            loadLogData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error("Error updating status:", error);
        showAlert("Gagal mengubah status: " + error.message, "error");
    }
}

async function deletePaket(id_barang) {
    if (!confirm("Apakah Anda yakin ingin menghapus paket ini?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/barang/${id_barang}`, {
            method: "DELETE",
        });

        const result = await response.json();

        if (result.success) {
            showAlert("Paket berhasil dihapus!", "success");
            loadBarangData();
            loadLogData();
        } else {
            throw new Error(result.error || "Gagal menghapus paket");
        }
    } catch (error) {
        console.error("Error deleting package:", error);
        showAlert("Gagal menghapus paket: " + error.message, "error");
    }
}

function showPenerimaForm(penerima = null) {
    const formContainer = document.getElementById('form-penerima-container');
    const formTitle = document.getElementById('form-penerima-title');
    const form = document.getElementById('form-penerima');
    
    if (!formContainer || !formTitle || !form) {
        console.error('❌ Form elements not found');
        return;
    }
    
    if (penerima) {
        // Edit mode
        formTitle.textContent = 'Edit Penerima';
        document.getElementById('penerima-id').value = penerima.id_kobong;
        document.getElementById('penerima-nama').value = penerima.nama_pembimbing;
        document.getElementById('penerima-kamar').value = penerima.nama_kamar;
        document.getElementById('penerima-jenis-kelamin').value = penerima.jenis_kelamin;
        document.getElementById('penerima-role').value = penerima.role;
        document.getElementById('penerima-nowa').value = penerima.no_wa;
    } else {
        // Add mode
        formTitle.textContent = 'Tambah Penerima Baru';
        form.reset();
        document.getElementById('penerima-id').value = '';
    }
    
    formContainer.style.display = 'block';
}

function hidePenerimaForm() {
    const formContainer = document.getElementById('form-penerima-container');
    if (formContainer) {
        formContainer.style.display = 'none';
    }
}

function editPenerima(id) {
    const penerima = kobongData.find(p => p.id_kobong == id);
    if (penerima) {
        showPenerimaForm(penerima);
    }
}

async function deletePenerima(id) {
    const penerima = kobongData.find(p => p.id_kobong == id);
    if (!penerima) return;

    if (!confirm(`Hapus penerima "${penerima.nama_pembimbing}"?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/kobong/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Penerima berhasil dihapus', 'success');
            loadPenerimaData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error deleting penerima:', error);
        showAlert('Gagal menghapus penerima: ' + error.message, 'error');
    }
}

// =============================================
// DETAIL MODAL FUNCTION
// =============================================

async function showDetail(id_barang) {
    try {
        const barang = barangData.find((b) => b.id_barang == id_barang);
        if (!barang) {
            showAlert('Data paket tidak ditemukan', 'error');
            return;
        }

        const modalBody = document.getElementById("modal-body");
        
        // Badge jenis kelamin
        const jenisKelaminBadge = barang.jenis_kelamin_penerima === 'putra' 
            ? '<span class="badge-putra">PUTRA</span>'
            : '<span class="badge-putri">PUTRI</span>';
        
        modalBody.innerHTML = `
            <div class="detail-item">
                <strong>Jenis Kelamin:</strong> ${jenisKelaminBadge}
            </div>
            <div class="detail-item">
                <strong>Tanggal Datang:</strong> ${new Date(barang.tanggal_datang).toLocaleString("id-ID")}
            </div>
            <div class="detail-item">
                <strong>Kamar:</strong> ${barang.nama_kamar || '-'}
            </div>
            <div class="detail-item">
                <strong>Pembimbing:</strong> ${barang.nama_pembimbing || '-'}
            </div>
            <div class="detail-item">
                <strong>No. WA:</strong> ${barang.no_wa || '-'}
            </div>
            <div class="detail-item">
                <strong>Pengirim:</strong> ${barang.nama_pengirim}
            </div>
            <div class="detail-item">
                <strong>Penerima:</strong> ${barang.nama_penerima}
            </div>
            <div class="detail-item">
                <strong>Jenis Barang:</strong> ${barang.jenis_barang}
            </div>
            <div class="detail-item">
                <strong>Status:</strong> <span class="status-badge status-${barang.status}">${barang.status}</span>
            </div>
            <div class="detail-item">
                <strong>Kondisi:</strong> <span class="status-badge kondisi-${barang.kondisi}">${barang.kondisi}</span>
            </div>
            <div class="detail-item">
                <strong>Tanggal Diambil:</strong> ${
                    barang.tanggal_diambil
                        ? new Date(barang.tanggal_diambil).toLocaleString("id-ID")
                        : "-"
                }
            </div>
            <div class="detail-item">
                <strong>Catatan:</strong> ${barang.catatan || "-"}
            </div>
            
            <!-- Action Buttons -->
            <div class="action-buttons" style="margin-top: 20px;">
                ${
                    barang.status === "masuk"
                        ? `
                        <button onclick="updateStatus(${barang.id_barang}, 'diambil')" class="btn-primary">
                            <i class="fas fa-check"></i> Tandai Sudah Diambil
                        </button>
                        `
                        : ""
                }
                <button onclick="closeModal()" class="btn-secondary" style="margin-left: 10px;">
                    <i class="fas fa-times"></i> Tutup
                </button>
            </div>
        `;

        document.getElementById("modal").style.display = "block";
    } catch (error) {
        console.error("Error showing detail:", error);
        showAlert("Gagal memuat detail paket", "error");
    }
}

// =============================================
// WHATSAPP & SYSTEM STATUS
// =============================================

function startQRPolling() {
    qrPollingInterval = setInterval(async () => {
        await checkWhatsAppStatus();
    }, 3000);
    checkWhatsAppStatus();
}

async function checkWhatsAppStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/status`);
        if (!response.ok) throw new Error("Network response was not ok");

        const status = await response.json();
        updateWhatsAppStatus(status);
    } catch (error) {
        console.error("Error checking WhatsApp status:", error);
        updateWhatsAppStatus({ isReady: false, qrCode: null });
    }
}

function updateWhatsAppStatus(status) {
    const waStatusElement = document.getElementById("wa-status");
    const qrImage = document.getElementById("qr-code-image");
    const qrContainer = document.getElementById("qr-code-container");
    const waConnected = document.getElementById("wa-connected");

    if (status.isReady) {
        waStatusElement.textContent = "Online";
        waStatusElement.className = "status online";
        qrContainer.style.display = "none";
        waConnected.style.display = "block";
    } else if (status.qrCode) {
        waStatusElement.textContent = "Scan QR";
        waStatusElement.className = "status connecting";
        
        qrImage.src = status.qrCode;
        qrContainer.style.display = "block";
        waConnected.style.display = "none";
        
        console.log("📱 QR Code received, showing in modal");
    } else {
        waStatusElement.textContent = "Offline";
        waStatusElement.className = "status offline";
        qrContainer.style.display = "none";
        waConnected.style.display = "none";
    }
}

function restartWhatsApp() {
    fetch(`${API_BASE_URL}/whatsapp/restart`, { method: "POST" })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                showAlert("WhatsApp restarting...", "success");
                closeQRModal();
            } else {
                showAlert("Gagal restart WhatsApp", "error");
            }
        })
        .catch((error) => {
            console.error("Error restarting WhatsApp:", error);
            showAlert("Error restarting WhatsApp", "error");
        });
}

async function updateSystemStatus() {
    try {
        // Check database status
        const dbResponse = await fetch(`${API_BASE_URL}/status/database`);
        const dbStatus = await dbResponse.json();

        updateStatusElement("db-status", dbStatus.status, dbStatus.message);

        // Check WhatsApp status
        const waResponse = await fetch(`${API_BASE_URL}/status/whatsapp`);
        const waStatus = await waResponse.json();

        updateStatusElement("wa-status", waStatus.status, waStatus.message);

    } catch (error) {
        console.error("Error updating system status:", error);
        updateStatusElement("db-status", "offline", "Cannot reach server");
        updateStatusElement("wa-status", "offline", "Cannot reach server");
    }
}

function updateStatusElement(elementId, status, message) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent =
        status === "online"
            ? "Online"
            : status === "connecting"
            ? "Connecting"
            : "Offline";

    element.className = `status ${status}`;
    element.title = message + " - " + new Date().toLocaleTimeString();
}

// =============================================
// LAPORAN & STATISTIK
// =============================================

function toggleReportFields() {
    const reportType = document.getElementById("report-type").value;
    const weeklyFields = document.getElementById("weekly-fields");
    const monthlyFields = document.getElementById("monthly-fields");

    if (reportType === "mingguan") {
        if (weeklyFields) weeklyFields.style.display = "block";
        if (monthlyFields) monthlyFields.style.display = "none";

        // Set default dates
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);

        const tanggalAwal = document.getElementById("tanggal_awal");
        const tanggalAkhir = document.getElementById("tanggal_akhir");
        
        if (tanggalAwal) tanggalAwal.value = oneWeekAgo.toISOString().split("T")[0];
        if (tanggalAkhir) tanggalAkhir.value = today.toISOString().split("T")[0];
    } else {
        if (weeklyFields) weeklyFields.style.display = "none";
        if (monthlyFields) monthlyFields.style.display = "block";

        const today = new Date();
        const bulanSelect = document.getElementById("bulan");
        const tahunInput = document.getElementById("tahun");
        
        if (bulanSelect) bulanSelect.value = today.getMonth() + 1;
        if (tahunInput) tahunInput.value = today.getFullYear();
    }
}

async function generateReport(format) {
    let tanggal_awal, tanggal_akhir, type;

    type = document.getElementById("report-type").value;

    if (type === "mingguan") {
        tanggal_awal = document.getElementById("tanggal_awal").value;
        tanggal_akhir = document.getElementById("tanggal_akhir").value;

        if (!tanggal_awal || !tanggal_akhir) {
            showAlert("Harap pilih tanggal awal dan akhir", "error");
            return;
        }
    } else {
        const bulan = document.getElementById("bulan").value;
        const tahun = document.getElementById("tahun").value;

        if (!bulan || !tahun) {
            showAlert("Harap pilih bulan dan tahun", "error");
            return;
        }

        tanggal_awal = `${tahun}-${bulan.padStart(2, "0")}-01`;
        const lastDay = new Date(tahun, bulan, 0).getDate();
        tanggal_akhir = `${tahun}-${bulan.padStart(2, "0")}-${lastDay}`;
    }

    try {
        let url;
        if (format === "excel") {
            url = `${API_BASE_URL}/report/excel?tanggal_awal=${tanggal_awal}&tanggal_akhir=${tanggal_akhir}&type=${type}`;
        } else {
            url = `${API_BASE_URL}/report/pdf?tanggal_awal=${tanggal_awal}&tanggal_akhir=${tanggal_akhir}&type=${type}`;
        }

        window.open(url, "_blank");
        showAlert(`Laporan ${format.toUpperCase()} sedang diproses...`, "success");
    } catch (error) {
        console.error("Error generating report:", error);
        showAlert("Gagal generate laporan: " + error.message, "error");
    }
}

function updateStats() {
    const totalPaket = barangData.length;
    const paketDiambil = barangData.filter((b) => b.status === "diambil").length;
    const paketMasuk = barangData.filter((b) => b.status === "masuk").length;
    const paketCepatBasi = barangData.filter((b) => b.kondisi === "cepat_basi").length;

    const totalPaketEl = document.getElementById("total-paket");
    const paketDiambilEl = document.getElementById("paket-diambil");
    const paketMasukEl = document.getElementById("paket-masuk");
    const paketCepatBasiEl = document.getElementById("paket-cepat-basi");

    if (totalPaketEl) totalPaketEl.textContent = totalPaket;
    if (paketDiambilEl) paketDiambilEl.textContent = paketDiambil;
    if (paketMasukEl) paketMasukEl.textContent = paketMasuk;
    if (paketCepatBasiEl) paketCepatBasiEl.textContent = paketCepatBasi;
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function formatRoleName(role) {
    const roleNames = {
        'pembimbing': 'Pembimbing',
        'pengasuh': 'Pengasuh', 
        'takhosus': 'Takhosus',
        'pegawai': 'Pegawai',
        'santri': 'Santri'
    };
    return roleNames[role] || role;
}

function showAlert(message, type = 'info') {
    // Hapus alert sebelumnya
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        ${message}
    `;
    
    const container = document.querySelector('.container');
    const header = document.querySelector('header');
    
    if (container && header) {
        container.insertBefore(alert, header);
    }
    
    // Auto remove setelah 5 detik
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function groupBarangByDate(barangData) {
    const grouped = {};
    
    barangData.forEach(barang => {
        const date = new Date(barang.tanggal_datang).toDateString();
        
        if (!grouped[date]) {
            grouped[date] = [];
        }
        
        grouped[date].push(barang);
    });
    
    // Urutkan tanggal descending (terbaru dulu)
    return Object.keys(grouped)
        .sort((a, b) => new Date(b) - new Date(a))
        .reduce((result, date) => {
            result[date] = grouped[date];
            return result;
        }, {});
}

function formatDateHeader(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'HARI INI';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'KEMARIN';
    } else {
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase();
    }
}

// =============================================
// MODAL FUNCTIONS
// =============================================

function showQRModal() {
    const modal = document.getElementById("qr-modal");
    if (modal) {
        modal.style.display = "block";
    }
}

function closeQRModal() {
    const modal = document.getElementById("qr-modal");
    if (modal) {
        modal.style.display = "none";
    }
}

function closeModal() {
    const modal = document.getElementById("modal");
    if (modal) {
        modal.style.display = "none";
    }
}

// Event listener untuk close modal ketika klik di luar
window.addEventListener("click", function (event) {
    const modal = document.getElementById("modal");
    const qrModal = document.getElementById("qr-modal");

    if (event.target === modal) closeModal();
    if (event.target === qrModal) closeQRModal();
});

// Close modal dengan ESC key
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeModal();
        closeQRModal();
    }
});



// Panggil debug saat load
setTimeout(debugTabs, 1000);