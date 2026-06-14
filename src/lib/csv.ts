// Builds a CSV string from headers + rows, escaping per RFC 4180.
type Cell = string | number | null | undefined;

function escape(value: Cell): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  // Prepend BOM so Excel opens UTF-8 (e.g. Hindi/Kannada) correctly.
  return "﻿" + lines.join("\r\n");
}
