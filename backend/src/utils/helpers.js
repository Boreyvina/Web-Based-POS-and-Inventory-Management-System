/** Round to 2 decimals, avoiding float drift (0.1 + 0.2 problems). */
function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Turn an array of flat objects into a CSV string. */
function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

/** Safe pagination values from query params. */
function paginate(qs) {
  const page = Math.max(1, parseInt(qs.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { money, toCSV, paginate };
