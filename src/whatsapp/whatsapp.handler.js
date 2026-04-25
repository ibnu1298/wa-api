const { routeCommand } = require("./command.router");

function registerWhatsAppHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message) return;
      if (msg.key.fromMe) return;
      let number = "";

      if (msg.author) {
        number = msg.author;
      } else {
        number = msg.from;
      }

      // normalize
      number = number.split("@")[0];
      console.log(`number: ${number}`);

      const jid = msg.key.remoteJid;

      const isPrivate = jid.includes("@s.whatsapp.net") || jid.includes("@lid");

      if (!isPrivate) return;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text;

      if (!text) return;

      console.log("📩 Incoming:", text);

      // 🔥 langsung lempar ke router
      await routeCommand(sock, jid, text, msg);
    } catch (err) {
      console.error("Error handler:", err);
    }
  });
}

module.exports = { registerWhatsAppHandler };
