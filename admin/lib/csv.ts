import "server-only";

/** Quote-escapes every cell (doubling embedded quotes, per RFC 4180) so
 * commas/quotes/newlines in real data — a company name with a comma, an
 * address with a line break — can't corrupt the file's column structure. */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  return lines.join("\n");
}
