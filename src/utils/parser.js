function parseMessage(text) {
  const type = text[0];

  if (type !== "+" && type !== "-") return null;

  const content = text.slice(1);
  const [item, nominal, category] = content.split(",");

  if (!item || !nominal || !category) return null;

  return {
    item: item.trim(),
    nominal: parseInt(nominal.trim()),
    category: category.trim().toLowerCase(),
    type: type === "+" ? "pemasukan" : "pengeluaran",
  };
}

module.exports = { parseMessage };
