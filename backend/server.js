// =============================================
// SISTEM MANAJEMEN PAKET PONDOK - BACKEND SERVER
// Complete fixed version with WhatsApp
// =============================================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./database");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const WhatsAppService = require("./routes/whatsappService");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARE SETUP
// =============================================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Initialize WhatsApp service
const whatsappService = new WhatsAppService();

// =============================================
// HEALTH CHECK & DEBUG ENDPOINTS
// =============================================
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/debug/kobong", async (req, res) => {
  try {
    const kobong = await db.getAllKobong();
    res.json({
      total: kobong.length,
      data: kobong
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// KOBNG/KAMAR ENDPOINTS - FIXED
// =============================================

/**
 * GET /api/kobong - Ambil semua data penerima
 */
app.get("/api/kobong", async (req, res) => {
  try {
    console.log('📦 GET /api/kobong called');
    const kobong = await db.getAllKobong();
    console.log(`✅ Found ${kobong.length} penerima`);
    res.json(kobong);
  } catch (error) {
    console.error('❌ Error in /api/kobong:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/kobong/:jenis_kelamin/:role - Ambil penerima by jenis kelamin dan role
 */
app.get("/api/kobong/:jenis_kelamin/:role", async (req, res) => {
  try {
    const { jenis_kelamin, role } = req.params;
    console.log(`📦 GET /api/kobong/${jenis_kelamin}/${role} called`);
    
    const kobong = await db.getKobongByJenisKelaminAndRole(jenis_kelamin, role);
    console.log(`✅ Found ${kobong.length} penerima for ${jenis_kelamin} ${role}`);
    
    res.json(kobong);
  } catch (error) {
    console.error(`❌ Error in /api/kobong/${req.params.jenis_kelamin}/${req.params.role}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/kobong/:jenis_kelamin/pembimbing - Ambil pembimbing untuk santri
 */
app.get("/api/kobong/:jenis_kelamin/pembimbing", async (req, res) => {
  try {
    const { jenis_kelamin } = req.params;
    console.log(`📦 GET /api/kobong/${jenis_kelamin}/pembimbing called`);
    
    const sql = 'SELECT * FROM kobong WHERE jenis_kelamin = ? AND role = "pembimbing" ORDER BY nama_pembimbing';
    const pembimbing = await db.query(sql, [jenis_kelamin]);
    
    console.log(`✅ Found ${pembimbing.length} pembimbing for ${jenis_kelamin}`);
    res.json(pembimbing);
  } catch (error) {
    console.error(`❌ Error in /api/kobong/${req.params.jenis_kelamin}/pembimbing:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/kobong - Tambah penerima baru
 */
app.post("/api/kobong", async (req, res) => {
  try {
    const { nama_kamar, nama_pembimbing, no_wa, jenis_kelamin, role } = req.body;
    
    console.log('📦 POST /api/kobong called:', { nama_kamar, nama_pembimbing, no_wa, jenis_kelamin, role });
    
    if (!nama_kamar || !nama_pembimbing || !no_wa || !jenis_kelamin || !role) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    
    const result = await db.addKobong({
      nama_kamar,
      nama_pembimbing,
      no_wa,
      jenis_kelamin,
      role
    });
    
    console.log('✅ Penerima added successfully');
    res.json({ 
      success: true, 
      message: 'Penerima berhasil ditambahkan',
      id: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error in POST /api/kobong:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/kobong/:id - Update data penerima
 */
app.put("/api/kobong/:id", async (req, res) => {
  try {
    const { nama_kamar, nama_pembimbing, no_wa, jenis_kelamin, role } = req.body;
    const id = req.params.id;
    
    console.log(`📦 PUT /api/kobong/${id} called`);
    
    if (!nama_kamar || !nama_pembimbing || !no_wa || !jenis_kelamin || !role) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    
    await db.updateKobong(id, {
      nama_kamar,
      nama_pembimbing,
      no_wa,
      jenis_kelamin,
      role
    });
    
    console.log('✅ Penerima updated successfully');
    res.json({ 
      success: true, 
      message: 'Data penerima berhasil diupdate'
    });
  } catch (error) {
    console.error(`❌ Error in PUT /api/kobong/${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/kobong/:id - Hapus data penerima
 */
app.delete("/api/kobong/:id", async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`📦 DELETE /api/kobong/${id} called`);
    
    const result = await db.deleteKobong(id);
    
    console.log('✅ Penerima deleted successfully');
    res.json({ 
      success: true, 
      message: 'Penerima berhasil dihapus'
    });
  } catch (error) {
    console.error(`❌ Error in DELETE /api/kobong/${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// BARANG/PAKET ENDPOINTS
// =============================================

/**
 * GET /api/barang - Ambil semua data paket
 */
app.get("/api/barang", async (req, res) => {
  try {
    console.log('📦 GET /api/barang called');
    const barang = await db.getAllBarang();
    console.log(`✅ Found ${barang.length} paket`);
    res.json(barang);
  } catch (error) {
    console.error('❌ Error in /api/barang:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/barang - Tambah paket baru
 */
app.post("/api/barang", async (req, res) => {
  try {
    console.log('📦 POST /api/barang called:', req.body);
    
    const result = await db.addBarang(req.body);
    
    // 🔥 PERBAIKAN: Ambil data barang dengan informasi kobong yang lengkap
    const barang = await db.getBarangWithKobong(result.insertId);
    
    // Kirim notifikasi WhatsApp - HANYA untuk barang baru
    if (barang) {
      try {
        await whatsappService.sendNotifPaketMasuk(barang);
      } catch (waError) {
        console.error('❌ WhatsApp notification failed:', waError.message);
        // Jangan gagalkan request hanya karena WhatsApp error
      }
    }
    
    console.log('✅ Paket added successfully, ID:', result.insertId);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('❌ Error in POST /api/barang:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/barang/:id/status - Update status paket
 */
app.put("/api/barang/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`📦 PUT /api/barang/${id}/status called:`, status);
    
    await db.updateBarangStatus(id, status);
    
    // 🔥 PERBAIKAN: Hanya kirim notifikasi jika status diambil dan barang ada
    if (status === 'diambil') {
      try {
        const barang = await db.getBarangWithKobong(id);
        if (barang) {
          await whatsappService.sendNotifPaketDiambil(barang);
        }
      } catch (waError) {
        console.error('❌ WhatsApp notification failed:', waError.message);
        // Jangan gagalkan request hanya karena WhatsApp error
      }
    }
    
    console.log('✅ Status updated successfully');
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ Error in PUT /api/barang/${req.params.id}/status:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/barang/:id - Hapus paket
 */
app.delete("/api/barang/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📦 DELETE /api/barang/${id} called`);
    
    const result = await db.deleteBarang(id);
    
    console.log('✅ Paket deleted successfully');
    res.json({
      success: true,
      message: "Paket berhasil dihapus",
      data: result,
    });
  } catch (error) {
    console.error(`❌ Error in DELETE /api/barang/${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =============================================
// LOG AKTIVITAS ENDPOINTS
// =============================================
app.get("/api/log", async (req, res) => {
  try {
    console.log('📦 GET /api/log called');
    const log = await db.getLogAktivitas();
    console.log(`✅ Found ${log.length} log entries`);
    res.json(log);
  } catch (error) {
    console.error('❌ Error in /api/log:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// LAPORAN ENDPOINTS
// =============================================

/**
 * GET /api/report/excel - Generate laporan Excel
 */
app.get("/api/report/excel", async (req, res) => {
  try {
    const { tanggal_awal, tanggal_akhir, type } = req.query;

    if (!tanggal_awal || !tanggal_akhir) {
      return res.status(400).json({ error: "Parameter tanggal_awal dan tanggal_akhir diperlukan" });
    }

    const sql = `
      SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
      FROM barang b 
      LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
      WHERE b.tanggal_datang BETWEEN ? AND ?
      ORDER BY b.tanggal_datang DESC
    `;

    const startDate = `${tanggal_awal} 00:00:00`;
    const endDate = `${tanggal_akhir} 23:59:59`;

    const barangData = await db.query(sql, [startDate, endDate]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Paket");

    // Setup columns
    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "Tanggal Datang", key: "tanggal_datang", width: 15 },
      { header: "Kamar", key: "kamar", width: 20 },
      { header: "Pembimbing", key: "pembimbing", width: 20 },
      { header: "Pengirim", key: "pengirim", width: 20 },
      { header: "Penerima", key: "penerima", width: 20 },
      { header: "Jenis Barang", key: "jenis_barang", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Kondisi", key: "kondisi", width: 12 },
      { header: "Catatan", key: "catatan", width: 30 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE6E6FA" },
    };

    // Add data rows
    barangData.forEach((barang, index) => {
      worksheet.addRow({
        no: index + 1,
        tanggal_datang: new Date(barang.tanggal_datang).toLocaleDateString("id-ID"),
        kamar: barang.nama_kamar || '-',
        pembimbing: barang.nama_pembimbing || '-',
        pengirim: barang.nama_pengirim,
        penerima: barang.nama_penerima,
        jenis_barang: barang.jenis_barang,
        status: barang.status,
        kondisi: barang.kondisi,
        catatan: barang.catatan || "-",
      });
    });

    // Setup response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-paket-${tanggal_awal}-hingga-${tanggal_akhir}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel report:", error);
    res.status(500).json({ error: error.message });
  }
});
/**
 * GET /api/report/pdf - Generate laporan PDF
 */
app.get("/api/report/pdf", async (req, res) => {
  try {
    const { tanggal_awal, tanggal_akhir, type } = req.query;

    if (!tanggal_awal || !tanggal_akhir) {
      return res.status(400).json({ error: "Parameter tanggal_awal dan tanggal_akhir diperlukan" });
    }

    const sql = `
      SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
      FROM barang b 
      LEFT JOIN kobong k ON b.id_kobong = k.id_kobong 
      WHERE b.tanggal_datang BETWEEN ? AND ?
      ORDER BY b.tanggal_datang DESC
    `;

    const startDate = `${tanggal_awal} 00:00:00`;
    const endDate = `${tanggal_akhir} 23:59:59`;

    const barangData = await db.query(sql, [startDate, endDate]);

    // Create PDF document
    const doc = new PDFDocument();
    
    // Setup response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-paket-${tanggal_awal}-hingga-${tanggal_akhir}.pdf"`
    );

    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('LAPORAN PAKET PONDOK', { align: 'center' });
    doc.fontSize(12).text(`Periode: ${tanggal_awal} hingga ${tanggal_akhir}`, { align: 'center' });
    doc.moveDown();

    if (barangData.length === 0) {
      doc.fontSize(14).text('Tidak ada data untuk periode ini', { align: 'center' });
      doc.end();
      return;
    }

    // Add table headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('No', 50, doc.y);
    doc.text('Tanggal', 80, doc.y);
    doc.text('Penerima', 150, doc.y);
    doc.text('Pengirim', 250, doc.y);
    doc.text('Jenis', 350, doc.y);
    doc.text('Status', 400, doc.y);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(450, doc.y).stroke();

    // Add data rows
    doc.font('Helvetica').fontSize(8);
    barangData.forEach((barang, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.text((index + 1).toString(), 50, doc.y);
      doc.text(new Date(barang.tanggal_datang).toLocaleDateString('id-ID'), 80, doc.y);
      doc.text(barang.nama_penerima, 150, doc.y);
      doc.text(barang.nama_pengirim, 250, doc.y);
      doc.text(barang.jenis_barang, 350, doc.y);
      doc.text(barang.status, 400, doc.y);
      
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({ error: error.message });
  }
});
// =============================================
// STATUS & WHATSAPP ENDPOINTS
// =============================================

/**
 * GET /api/status/database - Cek status database
 */
app.get("/api/status/database", async (req, res) => {
  try {
    const connection = await db.testConnection();
    res.json({
      status: connection ? "online" : "offline",
      message: connection ? "Database connected" : "Database disconnected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      status: "offline",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/status/whatsapp - Cek status WhatsApp
 */
app.get("/api/status/whatsapp", async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json({
      status: status.isReady ? "online" : status.qrCode ? "connecting" : "offline",
      message: status.isReady ? "WhatsApp connected" : status.qrCode ? "Scan QR code" : "WhatsApp disconnected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      status: "offline",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/whatsapp/status - Status WhatsApp untuk QR
 */
app.get("/api/whatsapp/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

/**
 * POST /api/whatsapp/restart - Restart WhatsApp service
 */
app.post("/api/whatsapp/restart", async (req, res) => {
  try {
    const result = await whatsappService.restart();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CATCH ALL ROUTE - Serve frontend
// =============================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// =============================================
// START SERVER
// =============================================
async function startServer() {
  try {
    console.log('🔄 Starting server...');
    
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.log('❌ Cannot start server without database');
      process.exit(1);
    }

    console.log('✅ Database connected successfully');

    // Initialize WhatsApp service
    whatsappService.initialize();
    console.log('📱 WhatsApp service initialized');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${process.env.DB_NAME}`);
      console.log(`🏠 Environment: ${process.env.NODE_ENV}`);
      console.log('\n✅ SERVER READY - All endpoints available!');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();