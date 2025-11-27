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
        // HAPUS executablePath untuk Windows
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
      console.log("📱 QR Code received, generating for frontend...");
      try {
        // Generate QR code untuk frontend
        this.qrCode = await qrcode.toDataURL(qr);
        console.log("✅ QR Code generated for frontend");
        this.notifyStatusChange();
      } catch (error) {
        console.error("❌ Error generating QR code:", error);
        this.qrCode = qr; // Fallback
        this.notifyStatusChange();
      }
    });

    this.client.on("ready", () => {
      console.log("✅ WhatsApp client is ready!");
      this.isReady = true;
      this.qrCode = null;
      this.notifyStatusChange();
    });

    this.client.on("authenticated", () => {
      console.log("✅ WhatsApp authenticated successfully");
    });

    this.client.on("auth_failure", (msg) => {
      console.error("❌ WhatsApp auth failed:", msg);
      this.isReady = false;
      this.qrCode = null;
      this.notifyStatusChange();
    });

    this.client.on("disconnected", (reason) => {
      console.log("❌ WhatsApp disconnected:", reason);
      this.isReady = false;
      this.qrCode = null;
      this.notifyStatusChange();
      
      // Auto restart
      setTimeout(() => {
        console.log("🔄 Auto-restarting WhatsApp...");
        this.initialize();
      }, 5000);
    });
  }

  // Untuk frontend bisa subscribe ke status changes
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

  async sendReminder(barang) {
    if (!this.isReady) {
      console.log("❌ WhatsApp not ready, cannot send reminder");
      return false;
    }

    try {
      let phoneNumber = barang.no_wa.trim();
      phoneNumber = phoneNumber.replace(/\D/g, "");

      // Format nomor
      if (phoneNumber.startsWith("0")) {
        phoneNumber = "62" + phoneNumber.substring(1);
      }
      if (!phoneNumber.startsWith("62")) {
        phoneNumber = "62" + phoneNumber;
      }

      console.log(`📤 Sending reminder to: ${phoneNumber} (${barang.nama_pembimbing})`);

      const chatId = `${phoneNumber}@c.us`;

      const message = `🚨 *SEGERA AMBIL* 🚨

📦 *Detail Paket:*
• Jenis: ${barang.jenis_barang}
• Pengirim: *${barang.nama_pengirim}*  
• Penerima: *${barang.nama_penerima}*
• Kamar: ${barang.nama_kamar}
• Datang: ${new Date(barang.tanggal_datang).toLocaleDateString('id-ID')}

💡 *Pesan:*
Paket ini cepat basi, jika tidak diambil dalam 24 jam, maka akan menjadi hak keamanan.

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

*-- Sistem Paket Pondok --*`;

      await this.client.sendMessage(chatId, message);
      console.log(`✅ Notifikasi terkirim ke ${barang.nama_pembimbing}`);
      
      return true;
    } catch (error) {
      console.error("❌ Error sending reminder:", error.message);
      return false;
    }
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