/**
 * OCR 100% local (base: teagar/secilita_planilhas): Tesseract.js com motor, worker e modelo
 * de português servidos pelo próprio site (pasta /ocr, copiada por `npm run assets`).
 * Nenhuma imagem sai do navegador. Em Node (scripts de auditoria) usa o modelo de node_modules.
 */
import type { Worker } from 'tesseract.js';

export const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

/** URL absoluta de um arquivo servido em public/ (respeita o `base` do Vite). */
export function publicAssetUrl(path: string): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? '/';
  return new URL(`${base.replace(/\/?$/, '/')}${path}`, window.location.origin).toString();
}

let workerPromise: Promise<Worker> | undefined;

async function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    if (IS_BROWSER) {
      return createWorker('por', 1, {
        workerPath: publicAssetUrl('ocr/worker.min.js'),
        corePath: publicAssetUrl('ocr/'),
        langPath: publicAssetUrl('ocr/lang'),
        gzip: true,
        workerBlobURL: false,
      });
    }
    return createWorker('por', 1, {
      langPath: 'node_modules/@tesseract.js-data/por/4.0.0_best_int',
      gzip: true,
      cacheMethod: 'none',
    });
  })();
  return workerPromise;
}

/** Amplia imagens pequenas e converte para tons de cinza, o que melhora fotos de celular. */
async function prepare(source: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement | Blob> {
  if (!IS_BROWSER || source instanceof HTMLCanvasElement) return source;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(source);
  } catch {
    return source; // formato que o navegador não decodifica (ex.: TIFF): o Tesseract tenta direto
  }
  const scale = bmp.width < 1600 ? Math.min(2.5, 1800 / bmp.width) : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;
  ctx.filter = 'grayscale(1) contrast(1.25)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

export async function ocr(source: Blob | HTMLCanvasElement | Uint8Array): Promise<string> {
  const worker = await getWorker();
  let img: Parameters<Worker['recognize']>[0];
  if (source instanceof Uint8Array) {
    img = IS_BROWSER
      ? await prepare(new Blob([source as Uint8Array<ArrayBuffer>]))
      : (globalThis as unknown as { Buffer: { from(u: Uint8Array): never } }).Buffer.from(source);
  } else if (!IS_BROWSER && source instanceof Blob) {
    img = (globalThis as unknown as { Buffer: { from(b: ArrayBuffer): never } }).Buffer.from(
      await source.arrayBuffer()
    );
  } else {
    img = await prepare(source);
  }
  const { data } = await worker.recognize(img);
  return data.text;
}

/** Encerra o worker do OCR (usado por scripts em Node para o processo terminar). */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise;
  workerPromise = undefined;
  await w.terminate();
}
