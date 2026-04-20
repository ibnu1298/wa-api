const { parseMessage } = require("../utils/parser");
const { extractNumber, getCategories } = require("../utils/helper");
const { saveToSheet } = require("../services/financial.service");

function registerWhatsAppHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message) return;
      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;
      const senderNumber = extractNumber(jid);

      const isPrivate = jid.includes("@s.whatsapp.net") || jid.includes("@lid");

      if (!isPrivate) return;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text;

      if (!text) return;

      const lowerText = text.toLowerCase();

      // prefix check
      if (!lowerText.startsWith("lapor")) return;

      const cleanText = text.slice(5).trim();

      if (!cleanText) return;

      console.log("📩 Incoming:", text);

      const parsed = parseMessage(cleanText);
      const categories = getCategories();

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
        await saveToSheet(parsed, senderNumber);
      } catch (err) {
        console.error("Gagal save:", err);

        await sock.sendMessage(jid, {
          text: "❌ Gagal simpan ke Google Sheets",
        });

        return;
      }

      await sock.sendMessage(jid, {
        text: "✅ Data keuangan berhasil dicatat",
      });
    } catch (err) {
      console.error("Error handler:", err);
    }
  });
}

module.exports = { registerWhatsAppHandler };
