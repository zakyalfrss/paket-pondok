// =============================================
// SISTEM MANAJEMEN PAKET PONDOK - DATABASE FUNCTIONS
// Fixed version with WhatsApp improvements
// =============================================

const mysql = require('mysql2/promise');
require('dotenv').config();

// =============================================
// DATABASE CONFIGURATION
// =============================================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'paket_pondok',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log('🔧 Database configuration:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database
});

const pool = mysql.createPool(dbConfig);

// =============================================
// CORE DATABASE FUNCTIONS
// =============================================

/**
 * Test database connection
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.execute('SELECT 1');
        connection.release();
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

/**
 * Execute SQL query dengan parameters
 */
async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// =============================================
// KOBNG/KAMAR FUNCTIONS - Data Penerima
// =============================================

/**
 * Get semua data penerima
 */
async function getAllKobong() {
    const sql = 'SELECT * FROM kobong ORDER BY jenis_kelamin, role, nama_pembimbing';
    return await query(sql);
}

/**
 * Get penerima by jenis kelamin dan role
 */
async function getKobongByJenisKelaminAndRole(jenis_kelamin, role) {
    const sql = 'SELECT * FROM kobong WHERE jenis_kelamin = ? AND role = ? ORDER BY nama_pembimbing';
    console.log(`🔍 Query: ${sql}, params: [${jenis_kelamin}, ${role}]`);
    
    const results = await query(sql, [jenis_kelamin, role]);
    console.log(`✅ Found ${results.length} penerima for ${jenis_kelamin} - ${role}`);
    
    return results;
}

/**
 * Get penerima by ID
 */
async function getKobongById(id) {
    const sql = 'SELECT * FROM kobong WHERE id_kobong = ?';
    const results = await query(sql, [id]);
    return results[0];
}

/**
 * Cari penerima berdasarkan nama atau kamar
 */
async function searchKobong(queryText) {
    const sql = `
        SELECT * FROM kobong 
        WHERE nama_pembimbing LIKE ? OR nama_kamar LIKE ?
        ORDER BY role, nama_pembimbing
    `;
    return await query(sql, [`%${queryText}%`, `%${queryText}%`]);
}

/**
 * Tambah penerima baru
 */
async function addKobong(kobongData) {
    const sql = `
        INSERT INTO kobong (nama_kamar, nama_pembimbing, no_wa, jenis_kelamin, role)
        VALUES (?, ?, ?, ?, ?)
    `;
    const params = [
        kobongData.nama_kamar,
        kobongData.nama_pembimbing,
        kobongData.no_wa,
        kobongData.jenis_kelamin,
        kobongData.role
    ];
    
    const result = await query(sql, params);
    
    // Log aktivitas
    await query(
        'INSERT INTO log_aktivitas (aksi, deskripsi) VALUES (?, ?)',
        ['tambah_penerima', `Penerima ${kobongData.nama_pembimbing} (${kobongData.role}) ditambahkan`]
    );
    
    return result;
}

/**
 * Update data penerima
 */
async function updateKobong(id, kobongData) {
    const sql = `
        UPDATE kobong 
        SET nama_kamar = ?, nama_pembimbing = ?, no_wa = ?, jenis_kelamin = ?, role = ?
        WHERE id_kobong = ?
    `;
    const params = [
        kobongData.nama_kamar,
        kobongData.nama_pembimbing,
        kobongData.no_wa,
        kobongData.jenis_kelamin,
        kobongData.role,
        id
    ];
    
    const result = await query(sql, params);
    
    // Log aktivitas
    await query(
        'INSERT INTO log_aktivitas (aksi, deskripsi) VALUES (?, ?)',
        ['update_penerima', `Data penerima ${kobongData.nama_pembimbing} diupdate`]
    );
    
    return result;
}

/**
 * Hapus data penerima
 */
async function deleteKobong(id) {
    const kamar = await getKobongById(id);
    
    if (!kamar) {
        throw new Error('Penerima tidak ditemukan');
    }
    
    // Cek apakah penerima masih memiliki paket
    const barangCount = await query('SELECT COUNT(*) as count FROM barang WHERE id_kobong = ?', [id]);
    if (barangCount[0].count > 0) {
        throw new Error('Tidak bisa menghapus penerima yang masih memiliki paket');
    }
    
    const sql = 'DELETE FROM kobong WHERE id_kobong = ?';
    const result = await query(sql, [id]);
    
    // Log aktivitas
    await query(
        'INSERT INTO log_aktivitas (aksi, deskripsi) VALUES (?, ?)',
        ['hapus_penerima', `Penerima ${kamar.nama_pembimbing} dihapus`]
    );
    
    return result;
}

// =============================================
// BARANG/PAKET FUNCTIONS - DIPERBAIKI
// =============================================

/**
 * Get semua data paket
 */
async function getAllBarang() {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa, k.role, k.jenis_kelamin
        FROM barang b 
        LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
        ORDER BY b.tanggal_datang DESC
    `;
    return await query(sql);
}

/**
 * Tambah paket baru
 */
async function addBarang(barangData) {
    const sql = `
        INSERT INTO barang (id_kobong, nama_pengirim, nama_penerima, jenis_barang, kondisi, catatan, jenis_kelamin_penerima)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        barangData.id_kobong || null,
        barangData.nama_pengirim,
        barangData.nama_penerima,
        barangData.jenis_barang,
        barangData.kondisi || 'baik',
        barangData.catatan || '',
        barangData.jenis_kelamin_penerima || 'putra'
    ];
    
    const result = await query(sql, params);
    
    // Log aktivitas
    await query(
        'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, "masuk", ?)',
        [result.insertId, `Paket ${barangData.jenis_barang} dari ${barangData.nama_pengirim} untuk ${barangData.nama_penerima} masuk`]
    );
    
    return result;
}

/**
 * Update status paket
 */
async function updateBarangStatus(id_barang, status) {
    const tanggal_diambil = status === 'diambil' ? new Date() : null;
    
    const sql = `UPDATE barang SET status = ?, tanggal_diambil = ? WHERE id_barang = ?`;
    const result = await query(sql, [status, tanggal_diambil, id_barang]);
    
    const barang = await getBarangById(id_barang);
    await query(
        'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, ?, ?)',
        [id_barang, status === 'diambil' ? 'diambil' : 'update_status', `Paket ${barang.jenis_barang} untuk ${barang.nama_penerima} status: ${status}`]
    );
    
    return result;
}

/**
 * Get paket by ID
 */
async function getBarangById(id_barang) {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa, k.role
        FROM barang b 
        LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
        WHERE b.id_barang = ?
    `;
    const results = await query(sql, [id_barang]);
    return results[0];
}

/**
 * 🔥 NEW METHOD: Get paket dengan informasi kobong lengkap
 */
async function getBarangWithKobong(id_barang) {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa, k.role, k.jenis_kelamin
        FROM barang b 
        LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
        WHERE b.id_barang = ?
    `;
    const results = await query(sql, [id_barang]);
    return results[0];
}

/**
 * Hapus paket
 */
async function deleteBarang(id_barang) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        console.log(`🗑️ Menghapus paket dengan ID: ${id_barang}`);

        // 1. Hapus log aktivitas terkait
        await connection.execute(
            'DELETE FROM log_aktivitas WHERE id_barang = ?',
            [id_barang]
        );

        // 2. Hapus paket
        const [deleteResult] = await connection.execute(
            'DELETE FROM barang WHERE id_barang = ?',
            [id_barang]
        );

        if (deleteResult.affectedRows === 0) {
            throw new Error('Paket tidak ditemukan');
        }

        console.log(`✅ Berhasil menghapus ${deleteResult.affectedRows} paket`);

        await connection.commit();
        
        return { 
            success: true, 
            changes: deleteResult.affectedRows,
            message: 'Paket berhasil dihapus' 
        };

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error menghapus paket:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

// =============================================
// LOG AKTIVITAS FUNCTIONS
// =============================================

/**
 * Get riwayat log aktivitas
 */
async function getLogAktivitas() {
    const sql = `
        SELECT l.*, 
               COALESCE(b.nama_penerima, 'Sistem') as nama_penerima, 
               COALESCE(b.jenis_barang, '') as jenis_barang, 
               COALESCE(k.nama_kamar, '') as nama_kamar 
        FROM log_aktivitas l 
        LEFT JOIN barang b ON l.id_barang = b.id_barang 
        LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
        ORDER BY l.waktu DESC LIMIT 100
    `;
    
    try {
        const result = await query(sql);
        console.log(`✅ Success loading logs, found ${result.length} logs`);
        return result;
    } catch (error) {
        console.log('❌ Error loading logs with join, trying simple query:', error.message);
        // Fallback ke query sederhana
        const simpleSql = `SELECT waktu, aksi, deskripsi FROM log_aktivitas ORDER BY waktu DESC LIMIT 100`;
        return await query(simpleSql);
    }
}

// =============================================
// WHATSAPP-RELATED FUNCTIONS - BARU
// =============================================

/**
 * 🔥 NEW METHOD: Get semua nomor WhatsApp untuk notifikasi
 */
async function getAllWhatsAppNumbers() {
    const sql = `
        SELECT no_wa, nama_pembimbing, role, nama_kamar 
        FROM kobong 
        WHERE no_wa IS NOT NULL AND no_wa != ''
    `;
    return await query(sql);
}

/**
 * 🔥 NEW METHOD: Get penerima berdasarkan ID barang
 */
async function getPenerimaByBarangId(id_barang) {
    const sql = `
        SELECT k.* 
        FROM kobong k
        INNER JOIN barang b ON k.id_kobong = b.id_kobong
        WHERE b.id_barang = ?
    `;
    const results = await query(sql, [id_barang]);
    return results[0] || null;
}

/**
 * 🔥 NEW METHOD: Get pembimbing untuk notifikasi tambahan
 */
async function getPembimbingByJenisKelamin(jenis_kelamin) {
    const sql = `
        SELECT * FROM kobong 
        WHERE jenis_kelamin = ? AND role = 'pembimbing' 
        AND no_wa IS NOT NULL AND no_wa != ''
    `;
    return await query(sql, [jenis_kelamin]);
}

// =============================================
// MODULE EXPORTS - DIPERBAIKI
// =============================================
module.exports = {
    testConnection,
    query,
    
    // Kobong functions
    getAllKobong,
    getKobongByJenisKelaminAndRole,
    getKobongById,
    searchKobong,
    addKobong,
    updateKobong,
    deleteKobong,
    
    // Barang functions
    getAllBarang,
    addBarang,
    updateBarangStatus,
    deleteBarang,
    getBarangById,
    getBarangWithKobong, // 🔥 NEW
    
    // Log functions
    getLogAktivitas,
    
    // 🔥 NEW WhatsApp functions
    getAllWhatsAppNumbers,
    getPenerimaByBarangId,
    getPembimbingByJenisKelamin
};