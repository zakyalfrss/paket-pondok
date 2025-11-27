const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // Password MySQL lokal
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

// Function testConnection yang lebih simple
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

// ... rest of your existing functions tetap sama

async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

async function getAllKobong() {
    return await query('SELECT * FROM kobong ORDER BY nama_kamar');
}

async function getAllBarang() {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
        FROM barang b 
        JOIN kobong k ON b.id_kobong = k.id_kobong 
        ORDER BY b.tanggal_datang DESC
    `;
    return await query(sql);
}

async function addBarang(barangData) {
    const sql = `
        INSERT INTO barang (id_kobong, nama_pengirim, nama_penerima, jenis_barang, kondisi, catatan)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
        barangData.id_kobong,
        barangData.nama_pengirim,
        barangData.nama_penerima,
        barangData.jenis_barang,
        barangData.kondisi || 'baik',
        barangData.catatan || ''
    ];
    
    const result = await query(sql, params);
    
    await query(
        'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, "masuk", ?)',
        [result.insertId, `Barang ${barangData.jenis_barang} dari ${barangData.nama_pengirim} untuk ${barangData.nama_penerima} masuk`]
    );
    
    return result;
}

async function updateBarangStatus(id_barang, status) {
    const tanggal_diambil = status === 'diambil' ? new Date() : null;
    
    const sql = `UPDATE barang SET status = ?, tanggal_diambil = ? WHERE id_barang = ?`;
    const result = await query(sql, [status, tanggal_diambil, id_barang]);
    
    const barang = await getBarangById(id_barang);
    await query(
        'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, ?, ?)',
        [id_barang, status === 'diambil' ? 'diambil' : 'update_status', `Barang ${barang.jenis_barang} untuk ${barang.nama_penerima} status: ${status}`]
    );
    
    return result;
}

async function updateBarangKondisi(id_barang, kondisi) {
    const sql = `UPDATE barang SET kondisi = ? WHERE id_barang = ?`;
    const result = await query(sql, [kondisi, id_barang]);
    
    const barang = await getBarangById(id_barang);
    await query(
        'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, "update_kondisi", ?)',
        [id_barang, `Kondisi barang ${barang.jenis_barang} diubah menjadi: ${kondisi}`]
    );
    
    return result;
}

async function deleteBarang(id_barang) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        console.log(`🗑️ Menghapus paket dengan ID: ${id_barang}`);

        // 1. Hapus dulu data di log_aktivitas yang reference ke barang ini
        const [logDelete] = await connection.execute(
            'DELETE FROM log_aktivitas WHERE id_barang = ?',
            [id_barang]
        );
        console.log(`📝 Menghapus ${logDelete.affectedRows} log aktivitas`);

        // 2. Baru hapus dari tabel barang
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

async function getBarangById(id_barang) {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
        FROM barang b 
        JOIN kobong k ON b.id_kobong = k.id_kobong 
        WHERE b.id_barang = ?
    `;
    const results = await query(sql, [id_barang]);
    return results[0];
}

async function getBarangCepatBasi() {
    const sql = `
        SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
        FROM barang b 
        JOIN kobong k ON b.id_kobong = k.id_kobong 
        WHERE b.kondisi = 'cepat_basi' 
        AND b.status = 'masuk'
        ORDER BY b.tanggal_datang DESC
    `;
    console.log('🔍 Executing getBarangCepatBasi query');
    const result = await query(sql);
    console.log(`📦 Found ${result.length} barang cepat basi`);
    return result;
}

async function getLogAktivitas() {
    // Coba beberapa kemungkinan struktur tabel
    const possibleQueries = [
        // Query 1: Jika ada kolom nama_penerima di log_aktivitas
        `SELECT * FROM log_aktivitas ORDER BY waktu DESC LIMIT 100`,
        
        // Query 2: Jika join dengan barang
        `SELECT l.*, b.nama_penerima, b.jenis_barang 
         FROM log_aktivitas l 
         LEFT JOIN barang b ON l.id_barang = b.id_barang 
         ORDER BY l.waktu DESC LIMIT 100`,
         
        // Query 3: Jika struktur sederhana
        `SELECT waktu, aksi, deskripsi FROM log_aktivitas ORDER BY waktu DESC LIMIT 100`
    ];
    
    for (let i = 0; i < possibleQueries.length; i++) {
        try {
            const result = await query(possibleQueries[i]);
            console.log(`✅ Success with query ${i + 1}, found ${result.length} logs`);
            return result;
        } catch (error) {
            console.log(`❌ Query ${i + 1} failed:`, error.message);
            continue;
        }
    }
    
    throw new Error('Tidak bisa mengambil data log dengan query apapun');
}

async function getTableStructure() {
    try {
        console.log('🔍 Checking table structures...');
        
        // Cek struktur log_aktivitas
        const logStructure = await query('DESCRIBE log_aktivitas');
        console.log('📋 log_aktivitas structure:', logStructure);
        
        // Cek struktur barang
        const barangStructure = await query('DESCRIBE barang');
        console.log('📦 barang structure:', barangStructure);
        
        // Cek struktur kobong
        const kobongStructure = await query('DESCRIBE kobong');
        console.log('🏠 kobong structure:', kobongStructure);
        
        return { logStructure, barangStructure, kobongStructure };
    } catch (error) {
        console.error('Error checking table structure:', error);
        return null;
    }
}
async function getAllKobong() {
    return await query('SELECT * FROM kobong ORDER BY nama_kamar');
}

async function getKobongById(id) {
    const sql = 'SELECT * FROM kobong WHERE id_kobong = ?';
    const results = await query(sql, [id]);
    return results[0];
}

async function addKobong(kobongData) {
    const sql = 'INSERT INTO kobong (nama_kamar, nama_pembimbing, no_wa) VALUES (?, ?, ?)';
    return await query(sql, [kobongData.nama_kamar, kobongData.nama_pembimbing, kobongData.no_wa]);
}

async function updateKobong(id, kobongData) {
    const sql = 'UPDATE kobong SET nama_kamar = ?, nama_pembimbing = ?, no_wa = ? WHERE id_kobong = ?';
    return await query(sql, [kobongData.nama_kamar, kobongData.nama_pembimbing, kobongData.no_wa, id]);
}

async function deleteKobong(id) {
    const sql = 'DELETE FROM kobong WHERE id_kobong = ?';
    return await query(sql, [id]);
}
// PASTIKAN SEMUA FUNCTION DIEKSPORT
module.exports = {
    testConnection,
    query,
    getAllKobong,
    getKobongById,
    addKobong,
    updateKobong,
    deleteKobong,
    getAllBarang,
    addBarang,
    updateBarangStatus,
    updateBarangKondisi,
    deleteBarang,
    getBarangById,
    getBarangCepatBasi,
    getLogAktivitas,
    getTableStructure
};