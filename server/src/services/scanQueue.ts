// Bounds how many card scans (GPT-4o vision call + Supabase upload) run at
// once — nothing enforced this before, so a burst of simultaneous scans
// could push memory past PM2's restart cap and crash-loop the whole app
// (see the WHATSAPP_VERIFY_TOKEN/PORT incident this followed). Single
// in-memory FIFO semaphore, safe because the server runs as one PM2 fork
// instance — no cross-process coordination needed.
const MAX_CONCURRENT_SCANS = 6;

let active = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_SCANS) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) {
    next();
    return;
  }
  active = Math.max(0, active - 1);
}

/** Runs fn once a scan slot is free, queueing FIFO beyond
 * MAX_CONCURRENT_SCANS instead of firing unbounded work immediately. */
export async function withScanSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
