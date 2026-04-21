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
  const hexColors = [
    "#FF6B6B", // merah
    "#4ECDC4", // teal
    "#FFD93D", // kuning
    "#458be7", // biru
    "#A29BFE", // ungu
    "#FD9644", // orange
    "#2ECC71", // hijau
    "#E84393", // pink
    "#7d048d", // violet
    "#95A5A6", // abu
  ];
  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);

    return {
      red: ((bigint >> 16) & 255) / 255,
      green: ((bigint >> 8) & 255) / 255,
      blue: (bigint & 255) / 255,
    };
  }

  const requests = [];

  categories.forEach((cat, i) => {
    const color = hexToRgb(hexColors[i % hexColors.length]);

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
  const rawCategories = process.env.CATEGORIES.split(",");
  const categoryMap = {};

  // contoh:
  // "Makan" → key: "makan", value: "Makan"
  rawCategories.forEach((cat) => {
    categoryMap[cat.trim().toLowerCase()] = cat.trim();
  });
  const displayCategory = categoryMap[data.category] || data.category;
  // 🔥 pastikan sheet ada
  await createSheetIfNotExists(sheets, sheetName);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          now,
          displayCategory,
          data.item,
          data.nominal,
          data.type,
          senderNumber,
        ],
      ],
    },
  });
}

module.exports = { saveToSheet };
