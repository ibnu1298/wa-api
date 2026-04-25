const { routeCommand } = require("./command.router");
const { isUserAllowed, getSenderNumber } = require("../utils/helper");

function registerWhatsAppHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message) return;
      if (msg.key.fromMe) return;

      const jid = msg.key.remoteJid;

      const isPrivate = jid.includes("@s.whatsapp.net") || jid.includes("@lid");

      if (!isPrivate) return;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text;

      if (!text) return;

      console.log("📩 Incoming:", text);

      // 🔒 cek whitelist

      const senderNumber = msg.key.participant || msg.key.remoteJid;
      console.log(`senderNumber : ${senderNumber.split("@")[0]}`);

      const allowed = await isUserAllowed(senderNumber.split("@")[0]);

      if (!allowed) {
        console.log("⛔ Not allowed:", senderNumber);
        return;
      }
      // 🔥 langsung lempar ke router
      await routeCommand(sock, jid, text, msg);
    } catch (err) {
      console.error("Error handler:", err);
    }
  });
}

module.exports = { registerWhatsAppHandler };
