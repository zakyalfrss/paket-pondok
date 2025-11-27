const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const db = require("../database");

class WhatsAppService {
  constructor() {
    console.log("🔄 Initializing WhatsApp Service untuk notifikasi...");

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "paket-pondok-notif",
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      },
    });

    this.isReady = false;
    this.qrCode = null;
    this.qrCodeListeners = [];
    this.sentReminders = new Map();

    this.setupEvents();
  }

  setupEvents() {
    console.log("🔧 Setting up WhatsApp events...");

    this.client.on("qr", async (qr) => {
      console.log("📱 QR Code received...");
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        console.log("✅ QR Code generated");
        this.notifyQRCodeListeners();
      } catch (error) {
        console.error("❌ Error generating QR code:", error);
      }
    });

    this.client.on("ready", () => {
      console.log("✅ WhatsApp client ready untuk kirim notifikasi!");
      this.isReady = true;
      this.qrCode = null;
      this.notifyQRCodeListeners();
      this.startMonitoring();
    });

    this.client.on("auth_failure", (msg) => {
      console.error("❌ WhatsApp auth failed:", msg);
      this.isReady = false;
      this.qrCode = null;
      this.notifyQRCodeListeners();
    });

    this.client.on("disconnected", (reason) => {
      console.log("❌ WhatsApp disconnected:", reason);
      this.isReady = false;
      this.qrCode = null;
      this.notifyQRCodeListeners();

      setTimeout(() => {
        this.initialize();
      }, 5000);
    });

    // HANYA KIRIM NOTIF, TIDAK TERIMA PESAN
    this.client.on("message", async (message) => {
      // Ignore semua pesan masuk
      return;
    });
  }

  async startMonitoring() {
    console.log("🔍 Starting monitoring untuk barang cepat basi...");

    // Cek setiap 30 menit
    setInterval(async () => {
      await this.checkBarangCepatBasi();
    }, 30 * 60 * 1000);

    // Cek sekali saat start
    await this.checkBarangCepatBasi();
  }

  async checkBarangCepatBasi() {
    try {
      const barangCepatBasi = await db.getBarangCepatBasi();
      console.log(`🔍 Found ${barangCepatBasi.length} barang cepat basi`);

      for (const barang of barangCepatBasi) {
        const reminderKey = `${barang.id_barang}_reminder`;

        if (!this.sentReminders.has(reminderKey)) {
          console.log(`📤 Sending reminder for barang ${barang.id_barang}`);
          await this.sendReminder(barang);
          this.sentReminders.set(reminderKey, Date.now());
        }
      }
    } catch (error) {
      console.error("Error checking barang cepat basi:", error);
    }
  }

  async sendReminder(barang) {
    if (!this.isReady) {
      console.log("WhatsApp not ready, skipping reminder");
      return;
    }

    try {
      let phoneNumber = barang.no_wa.trim();
      phoneNumber = phoneNumber.replace(/\D/g, "");

      if (phoneNumber.startsWith("0")) {
        phoneNumber = "62" + phoneNumber.substring(1);
      }

      if (!phoneNumber.startsWith("62")) {
        phoneNumber = "62" + phoneNumber;
      }

      console.log(`📞 Sending to: ${phoneNumber}`);

      if (phoneNumber.length < 10) {
        throw new Error(`Nomor tidak valid: ${phoneNumber}`);
      }

      const chatId = `${phoneNumber}@c.us`;

      const message = `🚨 *SEGERA AMBIL* 🚨

📦 *Detail Paket:*
• Jenis: ${barang.jenis_barang}
• Pengirim: *${barang.nama_pengirim}*  
• Penerima: *${barang.nama_penerima}*
• Kamar: ${barang.nama_kamar}
• Datang Pada Pukul: *${new Date(barang.tanggal_datang).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })}*

💡 *Pesan:*
Paket ini cepat basi, jika tidak di ambil dalam 24 jam, maka akan menjadi hak keamanan.

📝 *Catatan:* ${barang.catatan || "Tidak ada catatan"}

*-- Alf-Paket --*`;

      await this.client.sendMessage(chatId, message);
      console.log(`✅ Notifikasi terkirim ke ${barang.nama_pembimbing}`);

      // Log aktivitas
      await db.query(
        "INSERT INTO log_aktivitas (id_barang, aksi, deskripsi) VALUES (?, 'notif_cepat_basi', ?)",
        [barang.id_barang, `WhatsApp notif sent to ${barang.nama_pembimbing}`]
      );
    } catch (error) {
      console.error("❌ Error sending reminder:", error.message);
    }
  }

  onQRCodeChange(callback) {
    this.qrCodeListeners.push(callback);
  }

  notifyQRCodeListeners() {
    this.qrCodeListeners.forEach((callback) => {
      callback({
        qrCode: this.qrCode,
        isReady: this.isReady,
      });
    });
  }

  initialize() {
    this.client.initialize();
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isConnected: this.isReady,
      qrCode: this.qrCode,
    };
  }

  async restart() {
    try {
      await this.client.destroy();
      this.isReady = false;
      this.qrCode = null;
      this.sentReminders.clear();
      this.notifyQRCodeListeners();

      setTimeout(() => {
        this.initialize();
      }, 2000);

      return true;
    } catch (error) {
      console.error("Error restarting WhatsApp:", error);
      return false;
    }
  }
}

module.exports = WhatsAppService;
