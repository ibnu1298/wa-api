function extractNumber(jid) {
  return jid.split("@")[0];
}

function getCategories() {
  return process.env.CATEGORIES.split(",").map((c) => c.trim().toLowerCase());
}
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

async function getSheetIdByName(sheets, sheetName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
  });

  const sheet = res.data.sheets.find((s) => s.properties.title === sheetName);

  return sheet?.properties?.sheetId;
}
function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);

  return {
    red: ((bigint >> 16) & 255) / 255,
    green: ((bigint >> 8) & 255) / 255,
    blue: (bigint & 255) / 255,
  };
}

module.exports = {
  extractNumber,
  getCategories,
  getSheetName,
  getSheetIdByName,
  hexToRgb,
};
