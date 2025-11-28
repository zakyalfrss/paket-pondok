const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const db = require("../database");

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
  }

  // ===== NOTIFIKASI BARU =====
  
  // Notifikasi paket masuk
  async sendNotifPaketMasuk(barang) {
    if (!this.isReady) {
      console.log("❌ WhatsApp not ready, cannot send notification");
      return false;
    }

    try {
      const message = `📦 *PAKET BARU DATANG* 📦

*Detail Paket:*
• Untuk: *${barang.nama_penerima}*
• Pengirim: ${barang.nama_pengirim}
• Jenis: ${barang.jenis_barang}
• Kamar: ${barang.nama_kamar}
• Waktu: ${new Date(barang.tanggal_datang).toLocaleString('id-ID')}

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

_Segera ambil paket di loket pondok!_

*-- Sistem Paket Pondok --*`;

      // Kirim ke semua yang punya WhatsApp
      await this.broadcastToAll(message);
      
      console.log(`✅ Notifikasi paket masuk terkirim untuk ${barang.nama_penerima}`);
      return true;

    } catch (error) {
      console.error("❌ Error sending paket masuk notification:", error.message);
      return false;
    }
  }

  // Notifikasi paket diambil
  async sendNotifPaketDiambil(barang) {
    if (!this.isReady) {
      console.log("❌ WhatsApp not ready, cannot send notification");
      return false;
    }

    try {
      const message = `✅ *PAKET SUDAH DIAMBIL* ✅

*Detail Paket:*
• Penerima: *${barang.nama_penerima}*
• Pengirim: ${barang.nama_pengirim}
• Jenis: ${barang.jenis_barang}
• Kamar: ${barang.nama_kamar}
• Waktu Diambil: ${new Date().toLocaleString('id-ID')}

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

_Paket sudah diterima dengan baik_

*-- Sistem Paket Pondok --*`;

      // Kirim ke semua yang punya WhatsApp
      await this.broadcastToAll(message);
      
      console.log(`✅ Notifikasi paket diambil terkirim untuk ${barang.nama_penerima}`);
      return true;

    } catch (error) {
      console.error("❌ Error sending paket diambil notification:", error.message);
      return false;
    }
  }

  // Broadcast ke semua yang perlu terima notif
  async broadcastToAll(message) {
    try {
      // Ambil semua data kobong yang perlu dikirimi notif
      const allKobong = await db.getAllKobong();
      
      for (const kobong of allKobong) {
        // Format nomor WhatsApp
        let phoneNumber = kobong.no_wa.trim().replace(/\D/g, "");
        
        if (phoneNumber.startsWith("0")) {
          phoneNumber = "62" + phoneNumber.substring(1);
        }
        if (!phoneNumber.startsWith("62")) {
          phoneNumber = "62" + phoneNumber;
        }

        if (phoneNumber.length >= 10) {
          const chatId = `${phoneNumber}@c.us`;
          
          try {
            await this.client.sendMessage(chatId, message);
            console.log(`📤 Notifikasi terkirim ke ${kobong.nama_pembimbing}`);
          } catch (error) {
            console.error(`❌ Gagal kirim ke ${kobong.nama_pembimbing}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in broadcast:", error);
    }
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
}

module.exports = WhatsAppService;