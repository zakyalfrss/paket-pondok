-- =============================================
-- CREATE DATABASE
-- =============================================
CREATE DATABASE IF NOT EXISTS alf_paket;
USE alf_paket;

-- =============================================
-- TABLE: KOBNG/KAMAR - Untuk semua jenis penerima
-- =============================================
CREATE TABLE IF NOT EXISTS kobong (
    id_kobong INT AUTO_INCREMENT PRIMARY KEY,
    nama_kamar VARCHAR(100) NOT NULL,
    nama_pembimbing VARCHAR(100) NOT NULL,
    no_wa VARCHAR(20) NOT NULL,
    -- Role: pembimbing, pengasuh, takhosus, pegawai
    role ENUM('pembimbing', 'pengasuh', 'takhosus', 'pegawai') DEFAULT 'pembimbing',
    -- Jenis kelamin: putra atau putri
    jenis_kelamin ENUM('putra', 'putri') DEFAULT 'putra',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE: BARANG/PAKET - Data paket yang masuk
-- =============================================
CREATE TABLE IF NOT EXISTS barang (
    id_barang INT AUTO_INCREMENT PRIMARY KEY,
    id_kobong INT NULL, -- Bisa NULL untuk paket santri
    nama_pengirim VARCHAR(100) NOT NULL,
    nama_penerima VARCHAR(100) NOT NULL, -- Nama penerima (bisa pembimbing atau santri)
    jenis_barang VARCHAR(50) NOT NULL,
    kondisi ENUM('baik', 'cepat_basi', 'rusak') DEFAULT 'baik',
    status ENUM('masuk', 'diambil', 'rusak') DEFAULT 'masuk',
    catatan TEXT,
    tanggal_datang DATETIME DEFAULT CURRENT_TIMESTAMP,
    tanggal_diambil DATETIME NULL,
    -- Jenis kelamin penerima untuk filtering
    jenis_kelamin_penerima ENUM('putra', 'putri') DEFAULT 'putra',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_kobong) REFERENCES kobong(id_kobong) ON DELETE SET NULL
);

-- =============================================
-- TABLE: LOG AKTIVITAS - Riwayat sistem
-- =============================================
CREATE TABLE IF NOT EXISTS log_aktivitas (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_barang INT NULL,
    aksi VARCHAR(50) NOT NULL, -- masuk, diambil, update, dll
    deskripsi TEXT NOT NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_barang) REFERENCES barang(id_barang) ON DELETE SET NULL
);