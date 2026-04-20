require("dotenv").config();

const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const P = require("pino");
const QRCode = require("qrcode-terminal");
const multer = require("multer");
const fs = require("fs");

const { registerWhatsAppHandler } = require("./src/whatsapp/whatsapp.handler");

const app = express();
app.use(express.json());

let sock;
let isReady = false;

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: P({ level: "silent" }),
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan QR ini:");
      QRCode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
      isReady = true;
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      isReady = false;
      console.log("Koneksi terputus.");

      if (shouldReconnect) startWhatsApp();
    }
  });

  // 🔥 REGISTER HANDLER DI SINI
  registerWhatsAppHandler(sock);
}

startWhatsApp();

// ================= API =================

// kirim text
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        status: false,
        message: "to dan message wajib diisi",
      });
    }

    const jid = to + "@s.whatsapp.net";

    await sock.sendMessage(jid, { text: message });

    res.json({
      status: true,
      message: "Pesan berhasil dikirim",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Gagal kirim pesan",
    });
  }
});

// kirim file
app.post("/send-file", upload.single("file"), async (req, res) => {
  const { to, message } = req.body;
  const file = req.file;

  if (!to || (!message && !file)) {
    return res.status(400).json({
      success: false,
      message: "to & (message atau file) wajib diisi",
    });
  }

  const cleanNumber = to.replace(/[^0-9]/g, "");

  if (!/^[1-9][0-9]{9,14}$/.test(cleanNumber)) {
    return res.status(400).json({
      success: false,
      message: "Format nomor tidak valid",
    });
  }

  if (!isReady || !sock) {
    return res.status(503).json({
      success: false,
      message: "WhatsApp belum siap",
    });
  }

  const jid = cleanNumber + "@s.whatsapp.net";

  try {
    const [result] = await sock.onWhatsApp(jid);

    if (!result?.exists) {
      return res.status(400).json({
        success: false,
        message: "Nomor tidak terdaftar di WhatsApp",
      });
    }

    if (!file) {
      await sock.sendMessage(jid, { text: message });

      return res.json({
        success: true,
        to: cleanNumber,
        type: "text",
      });
    }

    const buffer = await fs.promises.readFile(file.path);

    const mediaPayload = {
      document: buffer,
      mimetype: file.mimetype,
      fileName: file.originalname,
      caption: message || "",
    };

    await sock.sendMessage(jid, mediaPayload);

    return res.json({
      success: true,
      to: cleanNumber,
      type: "file",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Gagal kirim",
    });
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server jalan di port", PORT);
});
