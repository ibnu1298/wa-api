const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const QRCode = require("qrcode-terminal");
require("dotenv").config();
const app = express();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { google } = require("googleapis");
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
let sock;
let isReady = false;
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
async function saveToSheet(data) {
  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });
  const categories = process.env.CATEGORIES.split(",").map((c) =>
    c.trim().toLowerCase(),
  );
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "ReportSheet!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [now, data.category, data.item, data.nominal, data.type, "WA BOT"],
      ],
    },
  });
}
function parseMessage(text) {
  const type = text[0];

  if (type !== "+" && type !== "-") return null;

  const content = text.slice(1);
  const [item, nominal, category] = content.split(",");

  if (!item || !nominal || !category) return null;

  return {
    item: item.trim(),
    nominal: parseInt(nominal.trim()),
    category: category.trim().toLowerCase(),
    type: type === "+" ? "pemasukan" : "pengeluaran",
  };
}
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
      retryCount = 0;
    }
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      isReady = false;
      console.log("Koneksi terputus.");
      if (shouldReconnect) {
        startWhatsApp();
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message) return;

      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;
      const isPrivate = jid.includes("@s.whatsapp.net") || jid.includes("@lid");

      // hanya chat pribadi
      if (!isPrivate) return;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text;

      if (!text) return;

      // normalize
      const lowerText = text.toLowerCase();

      // cek prefix
      if (!lowerText.startsWith("lapor")) return;

      // ambil isi setelah "lapor"
      const cleanText = text.slice(5).trim(); // 5 = panjang "lapor"
      if (!text) return;

      console.log("📩 Incoming:", text);

      const parsed = parseMessage(cleanText);

      if (!parsed) {
        await sock.sendMessage(jid, {
          text: "Format salah.\nContoh:\nlapor +beli kopi,10000,makan",
        });
        return;
      }
      if (!categories.includes(parsed.category)) {
        const list = categories.map((c) => `- ${c}`).join("\n");

        await sock.sendMessage(jid, {
          text: `❌ Kategori tidak valid.\n\nKategori tersedia:\n${list}`,
        });
        return;
      }

      try {
        await saveToSheet(parsed);
      } catch (err) {
        console.error("Gagal save:", err);

        await sock.sendMessage(jid, {
          text: "❌ Gagal simpan ke Google Sheets",
        });

        return;
      }
      console.log(parsed);
      await sock.sendMessage(jid, {
        text: "✅ Data keuangan berhasil dicatat",
      });
    } catch (err) {
      console.error("Error handle message:", err);
    }
  });
}

startWhatsApp();

// API kirim pesan
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

// API kirim file
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
    // Cek apakah nomor ada di WhatsApp
    const [result] = await sock.onWhatsApp(jid);

    if (!result?.exists) {
      return res.status(400).json({
        success: false,
        message: "Nomor tidak terdaftar di WhatsApp",
      });
    }

    // Jika hanya kirim text
    if (!file) {
      await sock.sendMessage(jid, { text: message });

      return res.json({
        success: true,
        to: cleanNumber,
        type: "text",
      });
    }

    // Jika kirim file
    const buffer = await fs.promises.readFile(file.path);

    let mediaPayload;

    if (file.mimetype.startsWith("image/")) {
      mediaPayload = {
        image: buffer,
        caption: message || "",
      };
    } else if (file.mimetype.startsWith("video/")) {
      mediaPayload = {
        video: buffer,
        caption: message || "",
      };
    } else if (file.mimetype === "application/pdf") {
      mediaPayload = {
        document: buffer,
        mimetype: "application/pdf",
        fileName: file.originalname,
        caption: message || "",
      };
    } else {
      // default kirim sebagai document
      mediaPayload = {
        document: buffer,
        mimetype: file.mimetype,
        fileName: file.originalname,
        caption: message || "",
      };
    }

    await sock.sendMessage(jid, mediaPayload);

    return res.json({
      success: true,
      to: cleanNumber,
      type: "file",
      fileName: file.originalname,
    });
  } catch (err) {
    console.error("Gagal kirim:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal mengirim pesan",
    });
  } finally {
    // Hapus file setelah selesai
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server jalan di port", PORT);
});
