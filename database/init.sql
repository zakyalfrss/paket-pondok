-- Create database jika belum ada
CREATE DATABASE IF NOT EXISTS paket_pondok;
USE paket_pondok;

-- Table kobong
CREATE TABLE IF NOT EXISTS kobong (
    id_kobong INT AUTO_INCREMENT PRIMARY KEY,
    nama_kamar VARCHAR(100) NOT NULL,
    nama_pembimbing VARCHAR(100) NOT NULL,
    no_wa VARCHAR(20) NOT NULL
);

-- Table barang
CREATE TABLE IF NOT EXISTS barang (
    id_barang INT AUTO_INCREMENT PRIMARY KEY,
    id_kobong INT NOT NULL,
    nama_pengirim VARCHAR(100) NOT NULL,
    nama_penerima VARCHAR(100) NOT NULL,
    jenis_barang VARCHAR(50) NOT NULL,
    kondisi ENUM('baik', 'cepat_basi', 'rusak') DEFAULT 'baik',
    status ENUM('masuk', 'diambil', 'rusak') DEFAULT 'masuk',
    catatan TEXT,
    tanggal_datang TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tanggal_diambil TIMESTAMP NULL,
    FOREIGN KEY (id_kobong) REFERENCES kobong(id_kobong)
);

-- Table log_aktivitas
CREATE TABLE IF NOT EXISTS log_aktivitas (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_barang INT NOT NULL,
    aksi VARCHAR(50) NOT NULL,
    deskripsi TEXT NOT NULL,
    waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_barang) REFERENCES barang(id_barang) ON DELETE CASCADE
);

-- Insert sample data kobong
INSERT IGNORE INTO kobong (id_kobong, nama_kamar, nama_pembimbing, no_wa) VALUES
(1, 'A-101', 'Ustadz Ahmad', '6281234567890'),
(2, 'A-102', 'Ustadz Bambang', '6281234567891'),
(3, 'B-201', 'Ustadz Cahyo', '6281234567892'),
(4, 'B-202', 'Ustadz Dani', '6281234567893');

-- Insert sample data barang
INSERT IGNORE INTO barang (id_barang, id_kobong, nama_pengirim, nama_penerima, jenis_barang, kondisi, status, catatan) VALUES
(1, 1, 'Orang Tua', 'Ahmad', 'Makanan', 'cepat_basi', 'masuk', 'Martabak manis'),
(2, 2, 'Kakak', 'Budi', 'Pakaian', 'baik', 'diambil', 'Baju koko baru'),
(3, 3, 'Ibu', 'Cahyo', 'Buku', 'baik', 'masuk', 'Kitab kuning');