const { getSheetName, getSheetIdByName } = require("../../utils/helper");
const { google } = require("googleapis");
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const client = await auth.getClient();
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
