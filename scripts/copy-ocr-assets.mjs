// Copia o motor de OCR (Tesseract.js), o modelo de português e o worker do pdf.js para public/ocr,
// para o navegador nunca buscar nada em CDN em tempo de execução (base: teagar/secilita_planilhas).
import { copyFileSync, mkdirSync } from 'node:fs';

const out = 'public/ocr';
mkdirSync(`${out}/lang`, { recursive: true });
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const v of ['', '-simd', '-relaxedsimd']) {
  copyFileSync(
    `node_modules/tesseract.js-core/tesseract-core${v}-lstm.wasm.js`,
    `${out}/tesseract-core${v}-lstm.wasm.js`
  );
}
copyFileSync(
  'node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
  `${out}/lang/por.traineddata.gz`
);
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${out}/pdf.worker.min.mjs`);
console.log('OCR local e worker do PDF copiados para', out);
