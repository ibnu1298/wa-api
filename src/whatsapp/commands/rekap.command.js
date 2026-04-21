const { getSheetName } = require("../../utils/helper");

async function handleRekap(sock, jid, text, msg) {
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
const sheetName = getSheetName();
async function getSheetIdByName(sheets, sheetName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
  });

  const sheet = res.data.sheets.find((s) => s.properties.title === sheetName);

  return sheet?.properties?.sheetId;
}
module.exports = { handleRekap };
