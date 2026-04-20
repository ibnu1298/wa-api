async function handleRekap(sock, jid, text, msg) {
  await sock.sendMessage(jid, {
    text: "Ini rekap lu 😄",
  });
}
module.exports = { handleRekap };
