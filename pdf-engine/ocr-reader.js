// Tesseract.js, run from files shipped with the app (rules 2 and 6): its
// worker, its WebAssembly core and the language data all load from here, and
// nothing is cached or fetched from the internet. It runs in its own worker,
// apart from MuPDF's.
import Tesseract from '../node_modules/tesseract.js/dist/tesseract.esm.min.js';
import { wordsFrom } from './ocr-words.js';

const WORKER_PATH = new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url).href;
const CORE_PATH = new URL('../node_modules/tesseract.js-core/', import.meta.url).href;
const LANG_PATH = new URL('./ocr-languages/', import.meta.url).href;

export const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
];

// languages: codes from LANGUAGES. Returns { read(png, scale), stop() }.
// read gives the words on the picture, in page points (see ocr-words.js).
// Tesseract leans on the first language: with English first, Spanish loses its
// accents (niño reads as nino), while Spanish first still reads English well.
export async function createOcrReader(languages) {
  const ordered = [...languages].sort((a, b) => (a === 'eng') - (b === 'eng'));
  const worker = await Tesseract.createWorker(ordered.join('+'),Tesseract.OEM.LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    workerBlobURL: false,
    cacheMethod: 'none',
  });
  return {
    async read(png, scale) {
      const { data } = await worker.recognize(new Blob([png], { type: 'image/png' }), {}, { text: false, blocks: true });
      return wordsFrom(data.blocks, scale);
    },
    stop: () => worker.terminate(),
  };
}
