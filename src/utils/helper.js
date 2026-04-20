function extractNumber(jid) {
  return jid.split("@")[0];
}

function getCategories() {
  return process.env.CATEGORIES.split(",").map((c) => c.trim().toLowerCase());
}

module.exports = { extractNumber, getCategories };
