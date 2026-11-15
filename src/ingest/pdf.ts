/**
 * Leitura de PDF com pdf.js (base: teagar/secilita_planilhas): camada de texto reconstruída em
 * linhas; páginas sem texto (escaneadas) são renderizadas e passam pelo OCR local.
 */
import { linesFromItems, type PdfItem } from './pdflines';
import { IS_BROWSER, ocr, publicAssetUrl } from './ocr';

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | undefined;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    if (IS_BROWSER) {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = publicAssetUrl('ocr/pdf.worker.min.mjs');
      return pdfjs;
    }
    // Node (scripts de auditoria): build "legacy", sem worker nem DOM.
    const legacy = 'pdfjs-dist/legacy/build/pdf.mjs';
    return (await import(/* @vite-ignore */ legacy)) as PdfJs;
  })();
  return pdfjsPromise;
}

/** Imagem JPEG embutida no PDF (fallback de OCR em Node, onde não há canvas para renderizar). */
function embeddedJpeg(bytes: Uint8Array): Uint8Array | undefined {
  let start = -1;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      start = i;
      break;
    }
  }
  if (start < 0) return undefined;
  for (let i = bytes.length - 2; i > start + 100; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return bytes.slice(start, i + 2);
  }
  return undefined;
}

export interface PdfReadResult {
  text: string;
  method: 'Texto do PDF' | 'OCR local (PDF escaneado)';
  /** Primeira página renderizada (JPEG data URL), para a prévia ao lado do formulário. */
  previewImageUrl?: string;
}

export async function readPdf(buffer: ArrayBuffer): Promise<PdfReadResult> {
  const original = new Uint8Array(buffer).slice();
  const pdfjs = await loadPdfJs();
  // pdf.js transfere (detacha) o buffer recebido: passa uma cópia.
  const task = pdfjs.getDocument({ data: original.slice() });
  const pdf = await task.promise;
  const pages: string[] = [];
  let usedOcr = false;
  let previewImageUrl: string | undefined;

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.filter((x): x is PdfItem & typeof x => 'str' in x);
      const text = linesFromItems(items).join('\n');
      const hasText = text.replace(/\s/g, '').length >= 40;

      if (IS_BROWSER && (i === 1 || !hasText)) {
        const viewport = page.getViewport({ scale: 2.2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        if (i === 1) previewImageUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (!hasText) {
          usedOcr = true;
          pages.push(await ocr(canvas));
          continue;
        }
      }
      if (hasText) {
        pages.push(text);
        continue;
      }
      // Node: sem canvas, faz OCR da imagem escaneada embutida no PDF.
      const jpg = embeddedJpeg(original);
      if (jpg) {
        usedOcr = true;
        pages.push(await ocr(jpg));
      } else {
        pages.push(text);
      }
    }
  } finally {
    await task.destroy();
  }

  return {
    text: pages.join('\n'),
    method: usedOcr ? 'OCR local (PDF escaneado)' : 'Texto do PDF',
    previewImageUrl,
  };
}
