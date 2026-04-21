const { getSheetName, getSheetIdByName } = require("../../utils/helper");

async function handleRekap(sock, jid, text, msg) {
  const sheetName = getSheetName();
  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });
  let sheetId = await getSheetIdByName(sheets, sheetName);
  if (!sheetId) {
    await createSheetIfNotExists(sheets, sheetName);
    sheetId = await getSheetIdByName(sheets, sheetName);
  }
  const link = `https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID}/edit#gid=${sheetId}`;
  await sock.sendMessage(jid, {
    text: `📊 Rekap bulan ini (${sheetName}):\n${link}`,
  });
}

module.exports = { handleRekap };
