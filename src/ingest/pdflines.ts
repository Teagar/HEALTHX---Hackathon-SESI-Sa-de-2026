/** Reconstrói linhas a partir dos itens de texto do pdf.js (como `pdftotext -layout`). */

export interface PdfItem {
  str: string;
  transform: number[];
  width: number;
}

export function linesFromItems(items: PdfItem[]): string[] {
  const rows: { y: number; parts: { x: number; end: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, end: x + it.width, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let line = '';
    let lastEnd = -1;
    for (const p of r.parts) {
      if (lastEnd >= 0) {
        const gap = p.x - lastEnd;
        line += gap > 12 ? '    ' : gap > 1.5 ? ' ' : '';
      }
      line += p.s;
      lastEnd = p.end;
    }
    return line;
  });
}
