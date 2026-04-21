const { getSheetName, getSheetIdByName } = require("../../utils/helper");
const { google } = require("googleapis");
const { createSheetIfNotExists } = require("../../services/financial.service");
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
async function handleRekap(sock, jid, text, msg) {
  const client = await auth.getClient();
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
