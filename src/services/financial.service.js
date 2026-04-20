const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function saveToSheet(data, senderNumber) {
  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "ReportSheet!A:F",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [now, data.category, data.item, data.nominal, data.type, senderNumber],
      ],
    },
  });
}

module.exports = { saveToSheet };
