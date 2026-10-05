// Runs the engine off the UI thread. Each message is { id, method, args };
// the reply is { id, result } or { id, error }.
import { createEngine } from './engine.js';

const engine = createEngine();

// Big results are handed over instead of copied.
function transferables(method, result) {
  if (method === 'renderPage') return [result.pixels.buffer];
  if (method === 'pageSizes' || method === 'save' || method === 'extractPages') return [result.buffer];
  return [];
}

// The engine loads WebAssembly before this line runs. Anything sent earlier would be lost,
// so the client waits for this message.
self.onmessage = ({ data: { id, method, args } }) => {
  try {
    if (!Object.hasOwn(engine, method)) throw new Error('Unknown engine call.');
    const result = engine[method](...args);
    self.postMessage({ id, result }, transferables(method, result));
  } catch (err) {
    self.postMessage({ id, error: err.message || 'The PDF engine failed.' });
  }
};

self.postMessage({ ready: true });
