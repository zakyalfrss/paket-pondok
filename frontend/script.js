// Konfigurasi
const API_BASE_URL = "/api";
let kobongData = [];
let barangData = [];
let qrPollingInterval;
let qrAutoCloseTimer;
let countdownValue = 10;

// Initialize application
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
  startQRPolling();
  setInterval(updateSystemStatus, 30000);

  // Event listener untuk close modal
  window.addEventListener("click", function (event) {
    const modal = document.getElementById("modal");
    const qrModal = document.getElementById("qr-modal");

    if (event.target === modal) {
      closeModal();
    }
    if (event.target === qrModal) {
      closeQRModal();
    }
  });

  // Close modal dengan ESC
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeModal();
      closeQRModal();
    }
  });
});

// ===== AUTO-CLOSE FUNCTIONS =====
function showQRModal() {
  document.getElementById("qr-modal").style.display = "block";
  resetCountdown();
  startAutoClose();
}

function closeQRModal() {
  document.getElementById("qr-modal").style.display = "none";
  if (qrAutoCloseTimer) {
    clearInterval(qrAutoCloseTimer);
  }
}

function resetCountdown() {
  countdownValue = 10;
  const countdownElement = document.getElementById("countdown");
  if (countdownElement) {
    countdownElement.textContent = countdownValue;
  }
}

function startAutoClose() {
  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  qrAutoCloseTimer = setInterval(() => {
    countdownValue--;
    countdownElement.textContent = countdownValue;

    if (countdownValue <= 0) {
      closeQRModal();
    }
  }, 1000);
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

// ===== MAIN FUNCTIONS =====
async function initializeApp() {
  await loadKobongData();
  await loadBarangData();
  await loadLogData();
  updateSystemStatus();
  updateStats();
  toggleReportFields();
  updateReportButtons();
}

function openTab(tabName) {
  const tabContents = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContents.length; i++) {
    tabContents[i].classList.remove("active");
  }

  const tabButtons = document.getElementsByClassName("tab-button");
  for (let i = 0; i < tabButtons.length; i++) {
    tabButtons[i].classList.remove("active");
  }

  document.getElementById(tabName).classList.add("active");
  event.currentTarget.classList.add("active");

  if (tabName === "daftar") {
    loadBarangData();
  } else if (tabName === "log") {
    loadLogData();
  } else if (tabName === "laporan") {
    updateStats();
  }
}

async function loadKobongData() {
  try {
    const response = await fetch(`${API_BASE_URL}/kobong`);
    kobongData = await response.json();

    const kobongSelect = document.getElementById("id_kobong");
    const filterKobong = document.getElementById("filter-kobong");

    kobongSelect.innerHTML = '<option value="">Pilih Kamar</option>';
    filterKobong.innerHTML = '<option value="">Semua Kamar</option>';

    kobongData.forEach((kobong) => {
      const option = `<option value="${kobong.id_kobong}">${kobong.nama_kamar} - ${kobong.nama_pembimbing}</option>`;
      kobongSelect.innerHTML += option;
      filterKobong.innerHTML += option;
    });
  } catch (error) {
    console.error("Error loading kobong data:", error);
    showAlert("Gagal memuat data kamar", "error");
  }
}

async function loadBarangData() {
  try {
    const response = await fetch(`${API_BASE_URL}/barang`);
    barangData = await response.json();
    displayBarangData(barangData);
    updateStats();
  } catch (error) {
    console.error("Error loading barang data:", error);
    showAlert("Gagal memuat data paket", "error");
  }
}

function displayBarangData(data) {
  const tbody = document.querySelector("#table-paket tbody");
  tbody.innerHTML = "";

  data.forEach((barang, index) => {
    const row = document.createElement("tr");

    const takenButton =
      barang.status !== "diambil"
        ? `<button onclick="updateStatus(${barang.id_barang}, 'diambil')" class="btn-small btn-taken">
        <i class="fas fa-check"></i> Diambil
      </button>`
        : "";

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${new Date(barang.tanggal_datang).toLocaleDateString("id-ID")}</td>
      <td>${barang.nama_kamar}</td>
      <td>${barang.nama_pengirim}</td>
      <td>${barang.nama_penerima}</td>
      <td>${barang.jenis_barang}</td>
      <td><span class="status-badge status-${barang.status}">${
      barang.status
    }</span></td>
      <td><span class="status-badge kondisi-${barang.kondisi}">${
      barang.kondisi
    }</span></td>
      <td class="action-buttons">
        <button onclick="showDetail(${
          barang.id_barang
        })" class="btn-small btn-edit">
          <i class="fas fa-edit"></i> Edit
        </button>
        ${takenButton}
        <button onclick="deletePaket(${
          barang.id_barang
        })" class="btn-small btn-delete">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </td>
    `;

    tbody.appendChild(row);
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
  tbody.innerHTML = "";

  data.forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${new Date(log.waktu).toLocaleString("id-ID")}</td>
      <td>${log.aksi}</td>
      <td>${log.deskripsi}</td>
      <td>${log.nama_penerima}</td>
      <td>${log.nama_kamar}</td>
    `;
    tbody.appendChild(row);
  });
}

// Form submission
document
  .getElementById("form-paket")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = {
      id_kobong: document.getElementById("id_kobong").value,
      nama_pengirim: document.getElementById("nama_pengirim").value,
      nama_penerima: document.getElementById("nama_penerima").value,
      jenis_barang: document.getElementById("jenis_barang").value,
      kondisi: document.getElementById("kondisi").value,
      catatan: document.getElementById("catatan").value,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/barang`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        showAlert("Paket berhasil disimpan!", "success");
        this.reset();
        loadBarangData();

        if (formData.kondisi === "cepat_basi") {
          showAlert(
            "Notifikasi WhatsApp akan dikirim ke pembimbing kamar",
            "warning"
          );
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error saving package:", error);
      showAlert("Gagal menyimpan paket: " + error.message, "error");
    }
  });

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
      showAlert("Status paket berhasil diubah!", "success");
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

async function showDetail(id_barang) {
  try {
    const barang = barangData.find((b) => b.id_barang == id_barang);
    if (!barang) return;

    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <div class="detail-item">
        <strong>Tanggal Datang:</strong> ${new Date(
          barang.tanggal_datang
        ).toLocaleString("id-ID")}
      </div>
      <div class="detail-item">
        <strong>Kamar:</strong> ${barang.nama_kamar}
      </div>
      <div class="detail-item">
        <strong>Pembimbing:</strong> ${barang.nama_pembimbing}
      </div>
      <div class="detail-item">
        <strong>No. WA:</strong> ${barang.no_wa}
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
        <strong>Status:</strong> <span class="status-badge status-${
          barang.status
        }">${barang.status}</span>
      </div>
      <div class="detail-item">
        <strong>Kondisi:</strong> <span class="status-badge kondisi-${
          barang.kondisi
        }">${barang.kondisi}</span>
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
      
      <!-- TOMBOL ACTION - HAPUS DUPLIKASI -->
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
        ${
          barang.kondisi !== "cepat_basi"
            ? `
            <button onclick="updateKondisi(${barang.id_barang}, 'cepat_basi')" class="btn-warning">
                <i class="fas fa-exclamation-triangle"></i> Tandai Cepat Basi
            </button>
            `
            : ""
        }
        <!-- TOMBOL KIRIM NOTIFIKASI MANUAL -->
        ${
          barang.kondisi === "cepat_basi" && barang.status === "masuk"
            ? `
            <button onclick="sendReminder(${barang.id_barang})" class="btn-info">
                <i class="fab fa-whatsapp"></i> Kirim Notifikasi
            </button>
            `
            : ""
        }
      </div>
    `;

    document.getElementById("modal").style.display = "block";
  } catch (error) {
    console.error("Error showing detail:", error);
    showAlert("Gagal memuat detail paket", "error");
  }
}

async function updateKondisi(id_barang, kondisi) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/barang/${id_barang}/kondisi`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kondisi }),
      }
    );

    const result = await response.json();

    if (result.success) {
      showAlert("Kondisi paket berhasil diubah!", "success");
      document.getElementById("modal").style.display = "none";
      loadBarangData();
      loadLogData();

      if (kondisi === "cepat_basi") {
        showAlert(
          "Notifikasi WhatsApp akan dikirim ke pembimbing kamar",
          "warning"
        );
      }
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Error updating condition:", error);
    showAlert("Gagal mengubah kondisi: " + error.message, "error");
  }
}
// Fungsi untuk kirim notifikasi WhatsApp manual
async function sendReminder(id_barang) {
    // Cari data barang
    const barang = barangData.find(b => b.id_barang == id_barang);
    if (!barang) {
        showAlert('Data paket tidak ditemukan', 'error');
        return;
    }

    // Konfirmasi pengiriman
    const confirmationMessage = `Kirim notifikasi WhatsApp ke ${barang.nama_pembimbing} (${barang.no_wa})?\n\nPenerima: ${barang.nama_penerima}\nJenis: ${barang.jenis_barang}\nKamar: ${barang.nama_kamar}`;
    
    if (!confirm(confirmationMessage)) {
        return;
    }

    try {
        // Disable tombol selama proses
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
        button.disabled = true;

        const response = await fetch(`${API_BASE_URL}/barang/${id_barang}/remind`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ Notifikasi berhasil dikirim ke ${barang.nama_pembimbing}`, 'success');
            
            // Tambah log aktivitas
            await loadLogData();
            
        } else {
            throw new Error(result.error || 'Gagal mengirim notifikasi');
        }

    } catch (error) {
        console.error('Error sending reminder:', error);
        showAlert('❌ Gagal mengirim notifikasi: ' + error.message, 'error');
    } finally {
        // Reset tombol
        const button = event.target;
        button.innerHTML = '<i class="fab fa-whatsapp"></i> Kirim Notifikasi';
        button.disabled = false;
    }
}
// DELETE PAKET - FIX
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

// ===== LAPORAN FUNCTIONS =====
function toggleReportFields() {
  const reportType = document.getElementById("report-type").value;
  const weeklyFields = document.getElementById("weekly-fields");
  const monthlyFields = document.getElementById("monthly-fields");

  if (reportType === "mingguan") {
    weeklyFields.style.display = "block";
    monthlyFields.style.display = "none";

    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    document.getElementById("tanggal_awal").value = oneWeekAgo
      .toISOString()
      .split("T")[0];
    document.getElementById("tanggal_akhir").value = today
      .toISOString()
      .split("T")[0];
  } else {
    weeklyFields.style.display = "none";
    monthlyFields.style.display = "block";

    const today = new Date();
    document.getElementById("bulan").value = today.getMonth() + 1;
    document.getElementById("tahun").value = today.getFullYear();
  }
}

async function generateReport(format) {
  let url, tanggal_awal, tanggal_akhir, type;

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
  const paketCepatBasi = barangData.filter(
    (b) => b.kondisi === "cepat_basi"
  ).length;

  document.getElementById("total-paket").textContent = totalPaket;
  document.getElementById("paket-diambil").textContent = paketDiambil;
  document.getElementById("paket-masuk").textContent = paketMasuk;
  document.getElementById("paket-cepat-basi").textContent = paketCepatBasi;
}

// ===== WHATSAPP FUNCTIONS =====
function startQRPolling() {
  qrPollingInterval = setInterval(async () => {
    await checkWhatsAppStatus();
  }, 3000);
  checkWhatsAppStatus();
}
// ===== CRUD KAMAR FUNCTIONS =====

function showKamarForm(kamar = null) {
  const formContainer = document.getElementById('form-kamar-container');
  const formTitle = document.getElementById('form-kamar-title');
  const form = document.getElementById('form-kamar');
  
  if (kamar) {
    // Edit mode
    formTitle.textContent = 'Edit Kamar';
    document.getElementById('kamar-id').value = kamar.id_kobong;
    document.getElementById('kamar-nama').value = kamar.nama_kamar;
    document.getElementById('kamar-pembimbing').value = kamar.nama_pembimbing;
    document.getElementById('kamar-nowa').value = kamar.no_wa;
  } else {
    // Add mode
    formTitle.textContent = 'Tambah Kamar Baru';
    form.reset();
    document.getElementById('kamar-id').value = '';
  }
  
  formContainer.style.display = 'block';
}

function hideKamarForm() {
  document.getElementById('form-kamar-container').style.display = 'none';
}

// Load data kamar
async function loadKamarData() {
  try {
    const response = await fetch(`${API_BASE_URL}/kobong`);
    kobongData = await response.json();
    displayKamarData(kobongData);
    
    // Update dropdowns di form paket
    updateKobongDropdowns();
  } catch (error) {
    console.error('Error loading kamar data:', error);
    showAlert('Gagal memuat data kamar', 'error');
  }
}

// Display data kamar di table
function displayKamarData(data) {
  const tbody = document.querySelector('#table-kamar tbody');
  tbody.innerHTML = '';

  data.forEach((kamar, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${kamar.nama_kamar}</td>
      <td>${kamar.nama_pembimbing}</td>
      <td>${kamar.no_wa}</td>
      <td class="action-buttons">
        <button onclick="editKamar(${kamar.id_kobong})" class="btn-small btn-edit">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="deleteKamar(${kamar.id_kobong})" class="btn-small btn-delete">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Update dropdown kamar di form paket
function updateKobongDropdowns() {
  const kobongSelect = document.getElementById('id_kobong');
  const filterKobong = document.getElementById('filter-kobong');

  kobongSelect.innerHTML = '<option value="">Pilih Kamar</option>';
  filterKobong.innerHTML = '<option value="">Semua Kamar</option>';

  kobongData.forEach((kamar) => {
    const option = `<option value="${kamar.id_kobong}">${kamar.nama_kamar} - ${kamar.nama_pembimbing}</option>`;
    kobongSelect.innerHTML += option;
    filterKobong.innerHTML += option;
  });
}

// Edit kamar
function editKamar(id) {
  const kamar = kobongData.find(k => k.id_kobong == id);
  if (kamar) {
    showKamarForm(kamar);
  }
}

// Delete kamar
async function deleteKamar(id) {
  const kamar = kobongData.find(k => k.id_kobong == id);
  if (!kamar) return;

  if (!confirm(`Hapus kamar "${kamar.nama_kamar}"?`)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/kobong/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showAlert('Kamar berhasil dihapus', 'success');
      loadKamarData();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error deleting kamar:', error);
    showAlert('Gagal menghapus kamar: ' + error.message, 'error');
  }
}

// Form submission untuk kamar
document.getElementById('form-kamar').addEventListener('submit', async function(e) {
  e.preventDefault();

  const formData = {
    nama_kamar: document.getElementById('kamar-nama').value,
    nama_pembimbing: document.getElementById('kamar-pembimbing').value,
    no_wa: document.getElementById('kamar-nowa').value
  };

  const kamarId = document.getElementById('kamar-id').value;

  try {
    let response;
    if (kamarId) {
      // Update existing
      response = await fetch(`${API_BASE_URL}/kobong/${kamarId}`, {
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
      showAlert(`Kamar berhasil ${kamarId ? 'diupdate' : 'ditambahkan'}`, 'success');
      hideKamarForm();
      loadKamarData();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error saving kamar:', error);
    showAlert('Gagal menyimpan kamar: ' + error.message, 'error');
  }
});

// ===== PERBAIKI WHATSAPP QR CODE =====

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
    
    // QR Code dari backend sudah dalam format data URL
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

// ===== UPDATE INITIALIZE APP =====

async function initializeApp() {
  await loadKamarData();  // Load data kamar dulu
  await loadBarangData();
  await loadLogData();
  updateSystemStatus();
  updateStats();
  toggleReportFields();
  updateReportButtons();
}

// Update openTab function untuk handle tab kamar
function openTab(tabName) {
  const tabContents = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContents.length; i++) {
    tabContents[i].classList.remove("active");
  }

  const tabButtons = document.getElementsByClassName("tab-button");
  for (let i = 0; i < tabButtons.length; i++) {
    tabButtons[i].classList.remove("active");
  }

  document.getElementById(tabName).classList.add("active");
  event.currentTarget.classList.add("active");

  if (tabName === "daftar") {
    loadBarangData();
  } else if (tabName === "kamar") {
    loadKamarData();
  } else if (tabName === "log") {
    loadLogData();
  } else if (tabName === "laporan") {
    updateStats();
  }
}
// ===== PREVIEW LAPORAN FUNCTIONS =====
let currentReportData = null;
let currentReportType = null;
let currentReportParams = null;

async function generateReport(format) {
  const params = getReportParams();
  if (!params) return;

  if (format === "preview") {
    await showReportPreview(params);
  } else {
    await downloadReportDirect(format, params);
  }
}

function getReportParams() {
  const type = document.getElementById("report-type").value;
  let tanggal_awal, tanggal_akhir;

  if (type === "mingguan") {
    tanggal_awal = document.getElementById("tanggal_awal").value;
    tanggal_akhir = document.getElementById("tanggal_akhir").value;

    if (!tanggal_awal || !tanggal_akhir) {
      showAlert("Harap pilih tanggal awal dan akhir", "error");
      return null;
    }
  } else {
    const bulan = document.getElementById("bulan").value;
    const tahun = document.getElementById("tahun").value;

    if (!bulan || !tahun) {
      showAlert("Harap pilih bulan dan tahun", "error");
      return null;
    }

    tanggal_awal = `${tahun}-${bulan.padStart(2, "0")}-01`;
    const lastDay = new Date(tahun, bulan, 0).getDate();
    tanggal_akhir = `${tahun}-${bulan.padStart(2, "0")}-${lastDay}`;
  }

  return {
    type,
    tanggal_awal,
    tanggal_akhir,
  };
}

async function showReportPreview(params) {
  try {
    // Show loading
    document.getElementById("preview-modal").style.display = "block";
    const previewBody = document.querySelector("#preview-table tbody");
    previewBody.innerHTML = `
            <tr>
                <td colspan="11" class="preview-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Memuat data laporan...</p>
                </td>
            </tr>
        `;

    console.log(
      `🔍 Fetching preview data for: ${params.tanggal_awal} to ${params.tanggal_akhir}`
    );

    // Get data for preview
    const response = await fetch(
      `${API_BASE_URL}/report/data?tanggal_awal=${params.tanggal_awal}&tanggal_akhir=${params.tanggal_akhir}&type=${params.type}`
    );

    // Check if response is HTML (error page)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(
        "Server returned HTML instead of JSON:",
        text.substring(0, 200)
      );
      throw new Error("Server error: Endpoint tidak tersedia");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Gagal memuat data laporan");
    }

    // Store data for download
    currentReportData = result.data;
    currentReportType = params.type;
    currentReportParams = params;

    // Display preview
    displayPreview(result.data, params);
    showAlert("Preview laporan berhasil dimuat", "success");
  } catch (error) {
    console.error("Error showing preview:", error);
    showAlert("Gagal memuat preview: " + error.message, "error");
    closePreviewModal();
  }
}

function displayPreview(data, params) {
  const previewBody = document.querySelector("#preview-table tbody");

  if (data.length === 0) {
    previewBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox"></i>
                    <p>Tidak ada data dalam periode ini</p>
                </td>
            </tr>
        `;
  } else {
    previewBody.innerHTML = data
      .map(
        (barang, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${new Date(barang.tanggal_datang).toLocaleDateString(
                  "id-ID"
                )}</td>
                <td>${barang.nama_kamar}</td>
                <td>${barang.nama_pembimbing}</td>
                <td>${barang.no_wa}</td>
                <td>${barang.nama_pengirim}</td>
                <td>${barang.nama_penerima}</td>
                <td>${barang.jenis_barang}</td>
                <td><span class="status-badge status-${barang.status}">${
          barang.status
        }</span></td>
                <td><span class="status-badge kondisi-${barang.kondisi}">${
          barang.kondisi
        }</span></td>
                <td>${barang.catatan || "-"}</td>
            </tr>
        `
      )
      .join("");
  }

  // Update preview info
  document.getElementById("preview-type").textContent = `Jenis: ${
    params.type === "mingguan" ? "Mingguan" : "Bulanan"
  }`;
  document.getElementById(
    "preview-period"
  ).textContent = `Periode: ${params.tanggal_awal} hingga ${params.tanggal_akhir}`;
  document.getElementById(
    "preview-total"
  ).textContent = `Total: ${data.length} paket`;
}

async function downloadReport() {
  if (!currentReportData || !currentReportParams) {
    showAlert("Tidak ada data untuk didownload", "error");
    return;
  }

  try {
    // Tanya user mau download format apa
    const format = confirm("Download sebagai Excel? (Cancel untuk PDF)")
      ? "excel"
      : "pdf";
    await downloadReportDirect(format, currentReportParams);
    closePreviewModal();
  } catch (error) {
    console.error("Error downloading report:", error);
    showAlert("Gagal download laporan: " + error.message, "error");
  }
}

async function downloadReportDirect(format, params) {
  try {
    let url;
    if (format === "excel") {
      url = `${API_BASE_URL}/report/excel?tanggal_awal=${params.tanggal_awal}&tanggal_akhir=${params.tanggal_akhir}&type=${params.type}`;
    } else {
      url = `${API_BASE_URL}/report/pdf?tanggal_awal=${params.tanggal_awal}&tanggal_akhir=${params.tanggal_akhir}&type=${params.type}`;
    }

    // Show loading
    showAlert(`Mempersiapkan download ${format.toUpperCase()}...`, "success");

    // Download file
    window.open(url, "_blank");
  } catch (error) {
    console.error("Error downloading report:", error);
    showAlert("Gagal download laporan: " + error.message, "error");
  }
}

function closePreviewModal() {
  document.getElementById("preview-modal").style.display = "none";
  currentReportData = null;
  currentReportType = null;
  currentReportParams = null;
}

// Update tombol di HTML tab laporan
function updateReportButtons() {
  const reportActions = document.querySelector(".report-actions");
  if (reportActions) {
    reportActions.innerHTML = `
            <button onclick="generateReport('preview')" class="btn-primary">
                <i class="fas fa-eye"></i> Preview Laporan
            </button>
            <button onclick="generateReport('excel')" class="btn-success">
                <i class="fas fa-file-excel"></i> Download Excel
            </button>
            <button onclick="generateReport('pdf')" class="btn-danger">
                <i class="fas fa-file-pdf"></i> Download PDF
            </button>
        `;
  }
}

// Update tombol di HTML tab laporan
function updateReportButtons() {
  // Ganti tombol existing dengan yang baru
  const reportActions = document.querySelector(".report-actions");
  reportActions.innerHTML = `
        <button onclick="generateReport('preview')" class="btn-primary">
            <i class="fas fa-eye"></i> Preview Laporan
        </button>
        <button onclick="generateReport('excel')" class="btn-success">
            <i class="fas fa-file-excel"></i> Download Excel
        </button>
        <button onclick="generateReport('pdf')" class="btn-danger">
            <i class="fas fa-file-pdf"></i> Download PDF
        </button>
    `;
}

async function checkWhatsAppStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/whatsapp/qr`);
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

// ===== FILTER FUNCTION =====
document
  .getElementById("filter-kobong")
  .addEventListener("change", filterBarang);
document
  .getElementById("filter-status")
  .addEventListener("change", filterBarang);

function filterBarang() {
  const kobongFilter = document.getElementById("filter-kobong").value;
  const statusFilter = document.getElementById("filter-status").value;

  let filteredData = barangData;

  if (kobongFilter) {
    filteredData = filteredData.filter(
      (barang) => barang.id_kobong == kobongFilter
    );
  }

  if (statusFilter) {
    filteredData = filteredData.filter(
      (barang) => barang.status === statusFilter
    );
  }

  displayBarangData(filteredData);
}

// System status - REAL CHECK
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

    console.log("🔄 System status updated:", {
      database: dbStatus.status,
      whatsapp: waStatus.status,
      time: new Date().toLocaleTimeString(),
    });
  } catch (error) {
    console.error("Error updating system status:", error);
    // Jika gagal fetch, set status offline
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

  // Tambahkan tooltip dengan message
  element.title = message + " - " + new Date().toLocaleTimeString();
}

// Update interval menjadi lebih sering untuk monitoring real-time
setInterval(updateSystemStatus, 10000); // Check setiap 10 detik
// ===== ALERT SYSTEM =====
function showAlert(message, type) {
  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  const existingAlerts = document.querySelectorAll(".alert");
  existingAlerts.forEach((alert) => alert.remove());

  const currentTab = document.querySelector(".tab-content.active");
  currentTab.insertBefore(alert, currentTab.firstChild);

  setTimeout(() => {
    alert.remove();
  }, 5000);
}
