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
  await applyCategoryColors(sheets, sheetName);
  await createPieChart(sheets, sheetName);
}
async function applyCategoryColors(sheets, sheetName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = res.data.sheets.find((s) => s.properties.title === sheetName);

  const sheetId = sheet.properties.sheetId;

  const categories = process.env.CATEGORIES.split(",").map((c) => c.trim());

  // warna random per kategori
  function getColor(index) {
    const colors = [
      { red: 1, green: 0.8, blue: 0.8 },
      { red: 0.8, green: 1, blue: 0.8 },
      { red: 0.8, green: 0.8, blue: 1 },
      { red: 1, green: 1, blue: 0.8 },
      { red: 0.9, green: 0.8, blue: 1 },
    ];
    return colors[index % colors.length];
  }

  const requests = [];

  categories.forEach((cat, i) => {
    const color = getColor(i);

    // kolom B (data)
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startColumnIndex: 1, // B
              endColumnIndex: 2,
            },
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: cat }],
            },
            format: {
              backgroundColor: color,
            },
          },
        },
        index: 0,
      },
    });

    // kolom H (kategori list)
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startColumnIndex: 7, // H
              endColumnIndex: 8,
            },
          ],
          booleanRule: {
            condition: {
              type: "TEXT_EQ",
              values: [{ userEnteredValue: cat }],
            },
            format: {
              backgroundColor: color,
            },
          },
        },
        index: 0,
      },
    });
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}

async function createPieChart(sheets, sheetName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = res.data.sheets.find((s) => s.properties.title === sheetName);

  const sheetId = sheet.properties.sheetId;

  const categories = process.env.CATEGORIES.split(",").map((c) => c.trim());

  const endRow = categories.length + 1;
  const colorMap = {
    makan: { red: 1, green: 0.6, blue: 0.6 },
    jajan: { red: 1, green: 1, blue: 0.4 },
    motor: { red: 0.6, green: 0.6, blue: 1 },
    belanja: { red: 0.6, green: 1, blue: 0.6 },
    "lain-lain": { red: 0.9, green: 0.9, blue: 0.9 },
  };
  const categories = process.env.CATEGORIES.split(",").map((c) =>
    c.trim().toLowerCase(),
  );
  const slices = categories.map((cat) => ({
    color: colorMap[cat] || { red: 0.8, green: 0.8, blue: 0.8 },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          addChart: {
            chart: {
              spec: {
                title: "Pengeluaran per Kategori",
                pieChart: {
                  pieHole: 0.5,
                  legendPosition: "LABELED_LEGEND",
                  domain: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId,
                          startRowIndex: 1, // H2
                          endRowIndex: endRow,
                          startColumnIndex: 7, // H
                          endColumnIndex: 8,
                        },
                      ],
                    },
                  },
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId,
                          startRowIndex: 1,
                          endRowIndex: endRow,
                          startColumnIndex: 8, // I
                          endColumnIndex: 9,
                        },
                      ],
                    },
                  },
                  threeDimensional: true,
                  slices: slices,
                },
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId,
                    rowIndex: 0,
                    columnIndex: 9, // kolom J
                  },
                  offsetXPixels: 20,
                  offsetYPixels: 20,
                  widthPixels: 400,
                  heightPixels: 300,
                },
              },
            },
          },
        },
      ],
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
