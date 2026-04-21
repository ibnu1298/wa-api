const { parseMessage } = require("../../utils/parser");
const { getCategories } = require("../../utils/helper");
const { saveToSheet } = require("../../services/financial.service");

async function handleLapor(sock, jid, text, msg) {
  const parsed = parseMessage(text);
  const categories = getCategories();

  if (!parsed) {
    await sock.sendMessage(jid, {
      text: "Format salah.\nContoh:\nlapor +beli kopi,10000,makan",
    });
    return;
  }
  const rawCategories = process.env.CATEGORIES.split(",");

  const categoryMap = {};

  // contoh:
  // "Makan" → key: "makan", value: "Makan"
  rawCategories.forEach((cat) => {
    categoryMap[cat.trim().toLowerCase()] = cat.trim();
  });
  if (!categoryMap[parsed.category]) {
    const list = categories.map((c) => `- ${c}`).join("\n");

    await sock.sendMessage(jid, {
      text: `❌ Kategori tidak valid.\n\nKategori tersedia:\n${list}`,
    });
    return;
  }

  const senderNumber = msg.key.participant || msg.key.remoteJid;

  try {
    await saveToSheet(parsed, senderNumber.split("@")[0]);
  } catch (err) {
    await sock.sendMessage(jid, {
      text: "❌ Gagal simpan ke Google Sheets",
    });
    return;
  }

  await sock.sendMessage(jid, {
    text: "✅ Data keuangan berhasil dicatat",
  });
}

module.exports = { handleLapor };
