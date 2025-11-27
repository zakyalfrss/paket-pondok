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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const whatsappService = new WhatsAppService();

// ===== HEALTH CHECK =====
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    environment: process.env.NODE_ENV || 'development'
  });
});

// ===== CRUD KOBNG/KAMAR =====
app.get("/api/kobong", async (req, res) => {
  try {
    const kobong = await db.getAllKobong();
    res.json(kobong);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/kobong/:id", async (req, res) => {
  try {
    const sql = 'SELECT * FROM kobong WHERE id_kobong = ?';
    const results = await db.query(sql, [req.params.id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Kamar tidak ditemukan' });
    }
    
    res.json(results[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/kobong", async (req, res) => {
  try {
    const { nama_kamar, nama_pembimbing, no_wa } = req.body;
    
    if (!nama_kamar || !nama_pembimbing || !no_wa) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    
    const sql = 'INSERT INTO kobong (nama_kamar, nama_pembimbing, no_wa) VALUES (?, ?, ?)';
    const result = await db.query(sql, [nama_kamar, nama_pembimbing, no_wa]);
    
    res.json({ 
      success: true, 
      message: 'Kamar berhasil ditambahkan',
      id: result.insertId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/kobong/:id", async (req, res) => {
  try {
    const { nama_kamar, nama_pembimbing, no_wa } = req.body;
    const id = req.params.id;
    
    if (!nama_kamar || !nama_pembimbing || !no_wa) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    
    const sql = 'UPDATE kobong SET nama_kamar = ?, nama_pembimbing = ?, no_wa = ? WHERE id_kobong = ?';
    const result = await db.query(sql, [nama_kamar, nama_pembimbing, no_wa, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kamar tidak ditemukan' });
    }
    
    res.json({ 
      success: true, 
      message: 'Kamar berhasil diupdate'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/kobong/:id", async (req, res) => {
  try {
    const id = req.params.id;
    
    const checkSql = 'SELECT COUNT(*) as count FROM barang WHERE id_kobong = ?';
    const checkResult = await db.query(checkSql, [id]);
    
    if (checkResult[0].count > 0) {
      return res.status(400).json({ 
        error: 'Tidak bisa menghapus kamar yang masih memiliki paket' 
      });
    }
    
    const sql = 'DELETE FROM kobong WHERE id_kobong = ?';
    const result = await db.query(sql, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kamar tidak ditemukan' });
    }
    
    res.json({ 
      success: true, 
      message: 'Kamar berhasil dihapus'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CRUD BARANG/PAKET =====
app.get("/api/barang", async (req, res) => {
  try {
    const barang = await db.getAllBarang();
    res.json(barang);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/barang", async (req, res) => {
  try {
    const result = await db.addBarang(req.body);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/barang/:id/remind', async (req, res) => {
  try {
    const barang = await db.getBarangById(req.params.id);
    
    if (!barang) {
      return res.status(404).json({ 
        success: false,
        error: 'Paket tidak ditemukan' 
      });
    }

    if (barang.kondisi !== 'cepat_basi') {
      return res.status(400).json({ 
        success: false,
        error: 'Hanya bisa kirim notifikasi untuk barang cepat basi' 
      });
    }

    if (barang.status !== 'masuk') {
      return res.status(400).json({ 
        success: false,
        error: 'Tidak bisa kirim notifikasi untuk barang yang sudah diambil' 
      });
    }

    console.log(`📤 Manual reminder request for barang ${barang.id_barang}`);
    console.log(`📞 Sending to: ${barang.no_wa} (${barang.nama_pembimbing})`);

    await whatsappService.sendReminder(barang);
    
    await db.query(
      'INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, "notifikasi", ?)',
      [barang.id_barang, `Notifikasi WhatsApp dikirim ke ${barang.nama_pembimbing} untuk paket cepat basi`]
    );

    console.log(`✅ Manual reminder sent successfully to ${barang.nama_pembimbing}`);
    
    res.json({ 
      success: true, 
      message: `Notifikasi berhasil dikirim ke ${barang.nama_pembimbing}` 
    });
    
  } catch (error) {
    console.error('❌ Error sending manual reminder:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.put("/api/barang/:id/status", async (req, res) => {
  try {
    await db.updateBarangStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/barang/:id/kondisi", async (req, res) => {
  try {
    await db.updateBarangKondisi(req.params.id, req.body.kondisi);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/barang/:id", async (req, res) => {
  try {
    const result = await db.deleteBarang(req.params.id);
    res.json({
      success: true,
      message: "Paket berhasil dihapus",
      data: result,
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== LOG AKTIVITAS =====
app.get("/api/log", async (req, res) => {
  try {
    const log = await db.getLogAktivitas();
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LAPORAN =====
app.get("/api/report/excel", async (req, res) => {
  try {
    const { tanggal_awal, tanggal_akhir, type } = req.query;

    if (!tanggal_awal || !tanggal_akhir) {
      return res.status(400).json({ error: "Parameter tanggal_awal dan tanggal_akhir diperlukan" });
    }

    console.log(`📊 Generating Excel report for: ${tanggal_awal} to ${tanggal_akhir}`);

    const sql = `
      SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
      FROM barang b 
      JOIN kobong k ON b.id_kobong = k.id_kobong 
      WHERE b.tanggal_datang BETWEEN ? AND ?
      ORDER BY b.tanggal_datang DESC
    `;

    const startDate = `${tanggal_awal} 00:00:00`;
    const endDate = `${tanggal_akhir} 23:59:59`;

    const barangData = await db.query(sql, [startDate, endDate]);

    console.log(`📦 Found ${barangData.length} records for Excel report`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Paket");

    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "Tanggal Datang", key: "tanggal_datang", width: 15 },
      { header: "Kamar", key: "kamar", width: 20 },
      { header: "Pembimbing", key: "pembimbing", width: 20 },
      { header: "No WA", key: "no_wa", width: 15 },
      { header: "Pengirim", key: "pengirim", width: 20 },
      { header: "Penerima", key: "penerima", width: 20 },
      { header: "Jenis Barang", key: "jenis_barang", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Kondisi", key: "kondisi", width: 12 },
      { header: "Catatan", key: "catatan", width: 30 },
      { header: "Tanggal Diambil", key: "tanggal_diambil", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE6E6FA" },
    };

    barangData.forEach((barang, index) => {
      worksheet.addRow({
        no: index + 1,
        tanggal_datang: new Date(barang.tanggal_datang).toLocaleDateString("id-ID"),
        kamar: barang.nama_kamar,
        pembimbing: barang.nama_pembimbing,
        no_wa: barang.no_wa,
        pengirim: barang.nama_pengirim,
        penerima: barang.nama_penerima,
        jenis_barang: barang.jenis_barang,
        status: barang.status,
        kondisi: barang.kondisi,
        catatan: barang.catatan || "-",
        tanggal_diambil: barang.tanggal_diambil
          ? new Date(barang.tanggal_diambil).toLocaleDateString("id-ID")
          : "-",
      });
    });

    worksheet.autoFilter = "A1:L1";

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

app.get("/api/report/pdf", async (req, res) => {
  try {
    const { tanggal_awal, tanggal_akhir, type } = req.query;

    if (!tanggal_awal || !tanggal_akhir) {
      return res.status(400).json({ error: "Parameter tanggal_awal dan tanggal_akhir diperlukan" });
    }

    console.log(`📊 Generating PDF report for: ${tanggal_awal} to ${tanggal_akhir}`);

    const sql = `
      SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
      FROM barang b 
      JOIN kobong k ON b.id_kobong = k.id_kobong 
      WHERE b.tanggal_datang BETWEEN ? AND ?
      ORDER BY b.tanggal_datang DESC
    `;

    const startDate = `${tanggal_awal} 00:00:00`;
    const endDate = `${tanggal_akhir} 23:59:59`;

    const barangData = await db.query(sql, [startDate, endDate]);

    console.log(`📦 Found ${barangData.length} records for PDF report`);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="laporan-paket-${tanggal_awal}-hingga-${tanggal_akhir}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(20).font("Helvetica-Bold").text("LAPORAN PAKET PONDOK", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).font("Helvetica")
      .text(`Periode: ${tanggal_awal} hingga ${tanggal_akhir}`, { align: "center" })
      .text(`Jenis Laporan: ${type}`, { align: "center" })
      .text(`Total Data: ${barangData.length} paket`, { align: "center" });
    doc.moveDown(2);

    if (barangData.length === 0) {
      doc.fontSize(14).text("Tidak ada data dalam periode ini", { align: "center" });
      doc.end();
      return;
    }

    const tableTop = doc.y;
    const headers = ["No", "Tanggal", "Kamar", "Pengirim", "Penerima", "Jenis", "Status", "Kondisi"];
    const columnWidth = 65;

    doc.font("Helvetica-Bold");
    let x = 50;
    headers.forEach((header) => {
      doc.text(header, x, tableTop, { width: columnWidth, align: "left" });
      x += columnWidth;
    });

    doc.moveTo(50, tableTop + 15)
      .lineTo(50 + headers.length * columnWidth, tableTop + 15)
      .stroke();

    doc.font("Helvetica");
    let y = tableTop + 25;

    barangData.forEach((barang, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
        doc.font("Helvetica-Bold");
        let x = 50;
        headers.forEach((header) => {
          doc.text(header, x, y, { width: columnWidth, align: "left" });
          x += columnWidth;
        });
        doc.moveTo(50, y + 15)
          .lineTo(50 + headers.length * columnWidth, y + 15)
          .stroke();
        y += 25;
        doc.font("Helvetica");
      }

      const row = [
        (index + 1).toString(),
        new Date(barang.tanggal_datang).toLocaleDateString("id-ID"),
        barang.nama_kamar,
        barang.nama_pengirim,
        barang.nama_penerima,
        barang.jenis_barang,
        barang.status,
        barang.kondisi,
      ];

      let x = 50;
      row.forEach((cell) => {
        const displayText = cell.length > 10 ? cell.substring(0, 10) + "..." : cell;
        doc.text(displayText, x, y, { width: columnWidth, align: "left" });
        x += columnWidth;
      });

      y += 20;
    });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/report/data", async (req, res) => {
  try {
    const { tanggal_awal, tanggal_akhir, type } = req.query;

    if (!tanggal_awal || !tanggal_akhir) {
      return res.status(400).json({
        success: false,
        error: "Parameter tanggal_awal dan tanggal_akhir diperlukan",
      });
    }

    console.log(`📊 Generating data preview for: ${tanggal_awal} to ${tanggal_akhir}`);

    const sql = `
      SELECT b.*, k.nama_kamar, k.nama_pembimbing, k.no_wa 
      FROM barang b 
      JOIN kobong k ON b.id_kobong = k.id_kobong 
      WHERE b.tanggal_datang BETWEEN ? AND ?
      ORDER BY b.tanggal_datang DESC
    `;

    const startDate = `${tanggal_awal} 00:00:00`;
    const endDate = `${tanggal_akhir} 23:59:59`;

    const barangData = await db.query(sql, [startDate, endDate]);

    console.log(`📦 Found ${barangData.length} records for preview`);

    res.json({
      success: true,
      data: barangData,
      total: barangData.length,
      periode: {
        mulai: tanggal_awal,
        hingga: tanggal_akhir,
        jenis: type,
      },
    });
  } catch (error) {
    console.error("Error generating data preview:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== STATUS ENDPOINTS =====
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

// ===== WHATSAPP ENDPOINTS =====
app.get("/api/whatsapp/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

app.get("/api/whatsapp/qr", (req, res) => {
  res.json(whatsappService.getStatus());
});

app.post("/api/whatsapp/restart", async (req, res) => {
  try {
    const result = await whatsappService.restart();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CATCH ALL ROUTE =====
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ===== START SERVER =====
async function startServer() {
  try {
    console.log('🔄 Starting server...');
    
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.log('❌ Cannot start server without database');
      console.log('💡 Please check:');
      console.log('   - MySQL service is running');
      console.log('   - Database credentials in .env');
      process.exit(1);
    }

    // Aktifkan WhatsApp
    whatsappService.initialize();
    console.log('📱 WhatsApp service initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${process.env.DB_NAME}`);
      console.log(`🏠 Environment: ${process.env.NODE_ENV}`);
      console.log(`📱 WhatsApp: Ready for QR scan`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();