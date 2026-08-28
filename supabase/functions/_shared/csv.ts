/**
 * Parser CSV mínimo (RFC 4180 suavizado): BOM, comillas y saltos de línea.
 * Sin dependencias — corre en Edge (Deno) y se cubre con deno test.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = splitCsv(cleaned);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((cols) => cols.some((c) => c.trim() !== ""))
    .map((cols) => {
      const rec: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        if (headers[i]) rec[headers[i]] = (cols[i] ?? "").trim();
      }
      return rec;
    });
}

export function esXlsx(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (quoted) {
    throw new Error("GC-IMP-006: CSV con comillas sin cerrar");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
