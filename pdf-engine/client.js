// The app's side of the engine (rule 9): the same calls as engine.js, but
// answered by the worker. Requests wait here until the worker has room, so a
// request that is no longer needed can still be cancelled before it starts.

const WORKER_URL = new URL('./worker.js', import.meta.url);
const MAX_IN_FLIGHT = 2;

export const isCancelled = (err) => err?.cancelled === true;

export function createEngineClient() {
  const worker = new Worker(WORKER_URL, { type: 'module' });
  const queue = [];
  const sent = new Map();
  let nextId = 1;
  let ready = false;

  function pump() {
    while (ready && sent.size < MAX_IN_FLIGHT && queue.length) {
      // Lowest priority number first; ties keep their order.
      let best = 0;
      queue.forEach((job, i) => { if (job.priority < queue[best].priority) best = i; });
      const job = queue.splice(best, 1)[0];
      sent.set(job.id, job);
      worker.postMessage({ id: job.id, method: job.method, args: job.args }, job.transfer);
    }
  }

  worker.onmessage = ({ data: { id, result, error, ready: started } }) => {
    if (started) {
      ready = true;
      pump();
      return;
    }
    const job = sent.get(id);
    sent.delete(id);
    if (job && !job.done) {
      job.done = true;
      if (error !== undefined) job.reject(new Error(error));
      else job.resolve(result);
    }
    pump();
  };

  worker.onerror = (event) => {
    event.preventDefault();
    const failure = new Error('The PDF engine stopped working.');
    for (const job of [...sent.values(), ...queue]) {
      if (!job.done) {
        job.done = true;
        job.reject(failure);
      }
    }
    sent.clear();
    queue.length = 0;
  };

  // Returns { promise, cancel }. A cancelled request rejects with a
  // cancellation (see isCancelled); one already running just has its answer dropped.
  function request(method, args, { priority = 0, transfer = [] } = {}) {
    const job = { id: nextId++, method, args, priority, transfer, done: false };
    const promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });
    queue.push(job);
    pump();
    const cancel = () => {
      if (job.done) return;
      job.done = true;
      const at = queue.indexOf(job);
      if (at !== -1) queue.splice(at, 1);
      job.reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
    };
    return { promise, cancel };
  }

  const call = (method, args, options) => request(method, args, options).promise;

  return {
    openDocument: (bytes) => call('openDocument', [bytes], { transfer: [bytes.buffer] }),
    authenticate: (id, password) => call('authenticate', [id, password]),
    closeDocument: (id) => call('closeDocument', [id]),
    pageSizes: (id) => call('pageSizes', [id]),
    getOutline: (id) => call('getOutline', [id]),
    getText: (id, index, priority) => request('getText', [id, index], { priority }),
    getLinks: (id, index, priority) => request('getLinks', [id, index], { priority }),
    renderPage: (id, index, scale, priority) => request('renderPage', [id, index, scale], { priority }),
    searchPage: (id, index, needle) => request('searchPage', [id, index, needle], { priority: 5 }),
    terminate: () => worker.terminate(),
  };
}
