const { handleLapor } = require("./commands/lapor.command");
const { handleRekap } = require("./commands/rekap.command");

const commands = {
  lapor: handleLapor,
  rekap: handleRekap,
};

function getCommand(text) {
  const parts = text.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  return { command, args };
}

async function routeCommand(sock, jid, text, msg) {
  const { command, args } = getCommand(text);

  const handler = commands[command];

  if (!handler) return; // command gak dikenal → diem

  await handler(sock, jid, args, msg);
}

module.exports = { routeCommand };
