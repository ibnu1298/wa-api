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

  if (!categories.includes(parsed.category)) {
    const list = categories.map((c) => `- ${c}`).join("\n");

    await sock.sendMessage(jid, {
      text: `❌ Kategori tidak valid.\n\nKategori tersedia:\n${list}`,
    });
    return;
  }

  const senderNumber = msg.key.participant || msg.key.remoteJid;
  let number = "";

  if (msg.author) {
    number = msg.author;
  } else {
    number = msg.from;
  }
  console.log(`number ${number}`);

  // normalize
  number = number.split("@")[0];
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
