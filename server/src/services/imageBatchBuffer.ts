// Groups photos sent within a short window of each other into one scan
// (front+back) instead of racing into two separate card-processing calls —
// WhatsApp/Telegram deliver each photo as its own webhook call with no
// built-in grouping, so this is the only place that grouping can happen.
// In-memory, keyed by userId — safe because the server runs as a single
// PM2 fork instance (see ecosystem.config.js); a multi-instance deployment
// would need this moved to a shared store instead.
const BATCH_WINDOW_MS = 4000;

export interface BatchedImage {
  mediaId: string;
  messageId: string;
}

interface Batch {
  images: BatchedImage[];
  timer: ReturnType<typeof setTimeout>;
}

const batches = new Map<string, Batch>();

export type BatchOutcome =
  | { kind: "single"; image: BatchedImage }
  | { kind: "pair"; front: BatchedImage; back: BatchedImage }
  | { kind: "too_many" };

/** Adds a photo to userId's in-flight batch, resetting the inactivity
 * timer. onSettle fires once BATCH_WINDOW_MS passes with no further photo,
 * with the outcome for however many arrived in that window. */
export function addToBatch(userId: string, image: BatchedImage, onSettle: (outcome: BatchOutcome) => void): void {
  const existing = batches.get(userId);
  const images = existing ? [...existing.images, image] : [image];
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    batches.delete(userId);
    if (images.length === 1) {
      onSettle({ kind: "single", image: images[0] });
    } else if (images.length === 2) {
      onSettle({ kind: "pair", front: images[0], back: images[1] });
    } else {
      onSettle({ kind: "too_many" });
    }
  }, BATCH_WINDOW_MS);

  batches.set(userId, { images, timer });
}
