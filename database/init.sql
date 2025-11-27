-- Create database and user (already done by environment variables)
USE paket_pondok;

-- Tabel kobong/kamar
CREATE TABLE IF NOT EXISTS kobong (
    id_kobong INT AUTO_INCREMENT PRIMARY KEY,
    nama_kamar VARCHAR(100) NOT NULL,
    nama_pembimbing VARCHAR(100) NOT NULL,
    no_wa VARCHAR(20) NOT NULL
);

-- Tabel barang/paket
CREATE TABLE IF NOT EXISTS barang (
    id_barang INT AUTO_INCREMENT PRIMARY KEY,
    id_kobong INT,
    nama_pengirim VARCHAR(100) NOT NULL,
    nama_penerima VARCHAR(100) NOT NULL,
    jenis_barang VARCHAR(50) NOT NULL,
    kondisi ENUM('baik', 'cepat_basi', 'rusak') DEFAULT 'baik',
    status ENUM('masuk', 'diambil', 'rusak') DEFAULT 'masuk',
    catatan TEXT,
    tanggal_datang DATETIME DEFAULT CURRENT_TIMESTAMP,
    tanggal_diambil DATETIME NULL,
    foto_bukti VARCHAR(255) NULL,
    FOREIGN KEY (id_kobong) REFERENCES kobong(id_kobong)
);

-- Tabel log aktivitas
CREATE TABLE IF NOT EXISTS log_aktivitas (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_barang INT,
    aksi VARCHAR(50) NOT NULL,
    deskripsi TEXT NOT NULL,
    waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_barang) REFERENCES barang(id_barang)
);

-- Sample data untuk kobong
INSERT IGNORE INTO kobong (id_kobong, nama_kamar, nama_pembimbing, no_wa) VALUES
(1, 'Al-Falah', 'Ustadz Ahmad', '628123456789'),
(2, 'Ar-Rahman', 'Ustadz Ali', '628987654321'),
(3, 'An-Nur', 'Ustadzah Siti', '628111223344');