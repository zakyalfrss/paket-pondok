// whatsappService.js - VERSION FIXED
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const db = require("../database"); // Pastikan path ini benar

class WhatsAppService {
  constructor() {
    console.log("🔄 Initializing WhatsApp Service...");

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "paket-pondok-notif"
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu"
        ]
      }
    });

    this.isReady = false;
    this.qrCode = null;
    this.statusListeners = [];
    this.notificationHistory = new Set(); // Prevent duplicate notifications

    // 🔥 FIX: Pindah setupEvents ke setelah deklarasi method
    this.setupEvents();
  }

  setupEvents() {
    console.log("🔧 Setting up WhatsApp events...");

    this.client.on("qr", async (qr) => {
      console.log("📱 QR Code received...");
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        console.log("✅ QR Code generated for frontend");
        this.notifyStatusChange();
      } catch (error) {
        console.error("❌ Error generating QR code:", error);
        this.qrCode = qr;
        this.notifyStatusChange();
      }
    });

    this.client.on("ready", () => {
      console.log("✅ WhatsApp client is ready!");
      this.isReady = true;
      this.qrCode = null;
      this.notifyStatusChange();
    });

    this.client.on("disconnected", (reason) => {
      console.log("❌ WhatsApp disconnected:", reason);
      this.isReady = false;
      this.qrCode = null;
      this.notifyStatusChange();
      
      setTimeout(() => {
        this.initialize();
      }, 5000);
    });

    this.client.on("auth_failure", (error) => {
      console.log("❌ WhatsApp auth failure:", error);
      this.isReady = false;
      this.qrCode = null;
      this.notifyStatusChange();
    });

    this.client.on("authenticated", () => {
      console.log("✅ WhatsApp authenticated successfully");
    });
  }

  // ===== NOTIFIKASI BARU - DIPERBAIKI =====
  
  // Notifikasi paket masuk - HANYA kirim ke penerima yang bersangkutan
  async sendNotifPaketMasuk(barang) {
    if (!this.isReady) {
      console.log("❌ WhatsApp not ready, cannot send notification");
      return false;
    }

    // 🔥 NEW: Cegah notifikasi duplikat
    const notificationKey = `paket-masuk-${barang.id_barang}`;
    if (this.notificationHistory.has(notificationKey)) {
      console.log(`⚠️ Notifikasi sudah dikirim sebelumnya untuk paket ${barang.id_barang}`);
      return false;
    }

    try {
      const message = `📦 *PAKET BARU DATANG* 📦

*Detail Paket:*
• Untuk: *${barang.nama_penerima}*
• Pengirim: ${barang.nama_pengirim}
• Jenis: ${barang.jenis_barang}
• Kamar: ${barang.nama_kamar || '-'}
• Waktu: ${new Date(barang.tanggal_datang).toLocaleString('id-ID')}

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

_Segera ambil paket di loket pondok!_

*-- Sistem Paket Pondok --*`;

      // 🔥 PERBAIKAN: Hanya kirim ke penerima yang bersangkutan, bukan semua orang
      const success = await this.sendToRelevantRecipients(barang, message);
      
      if (success) {
        this.notificationHistory.add(notificationKey);
        console.log(`✅ Notifikasi paket masuk terkirim untuk ${barang.nama_penerima}`);
      }
      
      return success;

    } catch (error) {
      console.error("❌ Error sending paket masuk notification:", error.message);
      return false;
    }
  }

  // Notifikasi paket diambil - HANYA kirim ke penerima yang bersangkutan
  async sendNotifPaketDiambil(barang) {
    if (!this.isReady) {
      console.log("❌ WhatsApp not ready, cannot send notification");
      return false;
    }

    // 🔥 NEW: Cegah notifikasi duplikat
    const notificationKey = `paket-diambil-${barang.id_barang}`;
    if (this.notificationHistory.has(notificationKey)) {
      console.log(`⚠️ Notifikasi sudah dikirim sebelumnya untuk paket ${barang.id_barang}`);
      return false;
    }

    try {
      const message = `✅ *PAKET SUDAH DIAMBIL* ✅

*Detail Paket:*
• Penerima: *${barang.nama_penerima}*
• Pengirim: ${barang.nama_pengirim}
• Jenis: ${barang.jenis_barang}
• Kamar: ${barang.nama_kamar || '-'}
• Waktu Diambil: ${new Date().toLocaleString('id-ID')}

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

_Paket sudah diterima dengan baik_

*-- Sistem Paket Pondok --*`;

      // 🔥 PERBAIKAN: Hanya kirim ke penerima yang bersangkutan, bukan semua orang
      const success = await this.sendToRelevantRecipients(barang, message);
      
      if (success) {
        this.notificationHistory.add(notificationKey);
        console.log(`✅ Notifikasi paket diambil terkirim untuk ${barang.nama_penerima}`);
      }
      
      return success;

    } catch (error) {
      console.error("❌ Error sending paket diambil notification:", error.message);
      return false;
    }
  }

  // 🔥 NEW METHOD: Kirim hanya ke penerima yang relevan
  async sendToRelevantRecipients(barang, message) {
    try {
      let successCount = 0;
      
      // 1. Kirim ke penerima langsung (berdasarkan id_kobong)
      if (barang.id_kobong) {
        const penerima = await db.getKobongById(barang.id_kobong);
        if (penerima && penerima.no_wa) {
          const sent = await this.sendToNumber(penerima.no_wa, message);
          if (sent) successCount++;
        }
      }

      // 2. Jika tidak ada id_kobong, coba cari berdasarkan nama
      if (successCount === 0 && barang.nama_penerima) {
        const penerima = await this.findPenerimaByName(barang.nama_penerima, barang.jenis_kelamin_penerima);
        if (penerima && penerima.no_wa) {
          const sent = await this.sendToNumber(penerima.no_wa, message);
          if (sent) successCount++;
        }
      }

      console.log(`📤 Notifikasi dikirim ke ${successCount} penerima`);
      return successCount > 0;

    } catch (error) {
      console.error("❌ Error sending to relevant recipients:", error);
      return false;
    }
  }

  // 🔥 NEW METHOD: Cari penerima berdasarkan nama
  async findPenerimaByName(nama, jenis_kelamin) {
    try {
      const sql = 'SELECT * FROM kobong WHERE nama_pembimbing LIKE ? AND jenis_kelamin = ? LIMIT 1';
      const results = await db.query(sql, [`%${nama}%`, jenis_kelamin]);
      return results[0] || null;
    } catch (error) {
      console.error("Error finding penerima by name:", error);
      return null;
    }
  }

  // 🔥 NEW METHOD: Kirim ke nomor tertentu
  async sendToNumber(phoneNumber, message) {
    try {
      // Format nomor WhatsApp
      let formattedNumber = phoneNumber.trim().replace(/\D/g, "");
      
      if (formattedNumber.startsWith("0")) {
        formattedNumber = "62" + formattedNumber.substring(1);
      }
      if (!formattedNumber.startsWith("62")) {
        formattedNumber = "62" + formattedNumber;
      }

      if (formattedNumber.length >= 10) {
        const chatId = `${formattedNumber}@c.us`;
        await this.client.sendMessage(chatId, message);
        console.log(`📤 Notifikasi terkirim ke ${formattedNumber}`);
        return true;
      }
      
      console.log(`❌ Nomor tidak valid: ${phoneNumber}`);
      return false;
    } catch (error) {
      console.error(`❌ Gagal kirim ke ${phoneNumber}:`, error.message);
      return false;
    }
  }

  // 🔥 NEW METHOD: Clear history ketika server restart
  clearNotificationHistory() {
    this.notificationHistory.clear();
    console.log("🧹 Notification history cleared");
  }

  // ===== FUNCTION LAIN =====
  
  onStatusChange(callback) {
    this.statusListeners.push(callback);
  }

  notifyStatusChange() {
    const status = this.getStatus();
    this.statusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error("Error in status listener:", error);
      }
    });
  }

  initialize() {
    try {
      console.log("🚀 Initializing WhatsApp client...");
      this.client.initialize();
    } catch (error) {
      console.error("❌ Failed to initialize WhatsApp:", error);
    }
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isConnected: this.isReady,
      qrCode: this.qrCode,
      timestamp: new Date().toISOString()
    };
  }

  async restart() {
    try {
      console.log("🔄 Restarting WhatsApp service...");
      this.clearNotificationHistory(); // 🔥 CLEAR history saat restart
      await this.client.destroy();
      this.isReady = false;
      this.qrCode = null;
      this.notifyStatusChange();

      setTimeout(() => {
        this.initialize();
      }, 3000);

      return true;
    } catch (error) {
      console.error("❌ Error restarting WhatsApp:", error);
      return false;
    }
  }

  async destroy() {
    try {
      await this.client.destroy();
      console.log("✅ WhatsApp client destroyed");
    } catch (error) {
      console.error("❌ Error destroying WhatsApp client:", error);
    }
  }
}

module.exports = WhatsAppService;