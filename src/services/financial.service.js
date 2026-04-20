const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
function getSheetName() {
  const now = new Date();

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "short",
    year: "numeric",
  })
    .format(now)
    .replace(" ", "-"); // contoh: Apr-2026
}
async function createSheetIfNotExists(sheets, sheetName) {
  const existingSheets = await getSheetList(sheets);

  if (existingSheets.includes(sheetName)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });

  // 👉 tambah header
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Tanggal", "Kategori", "Item", "Nominal", "Tipe", "Sumber"]],
    },
  });
  const categories = process.env.CATEGORIES.split(",").map((c) => c.trim());

  // isi kolom H & I
  const categoryRows = categories.map((cat, index) => {
    const rowIndex = index + 2; // mulai dari baris 2

    return [cat, `=SUMIFS(D$2:D,B$2:B,H${rowIndex},E$2:E,"pengeluaran")`];
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!H1:I1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Kategori", "Pengeluaran"]],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!H2:I${categories.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: categoryRows,
    },
  });
}

async function getSheetList(sheets) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  return res.data.sheets.map((s) => s.properties.title);
}
async function saveToSheet(data, senderNumber) {
  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });

  const sheetName = getSheetName();

  // 🔥 pastikan sheet ada
  await createSheetIfNotExists(sheets, sheetName);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [now, data.category, data.item, data.nominal, data.type, senderNumber],
      ],
    },
  });
}

module.exports = { saveToSheet };
