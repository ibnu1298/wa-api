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
module.exports = { extractNumber, getCategories, getSheetName };
