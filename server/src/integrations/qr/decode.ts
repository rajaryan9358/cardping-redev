import jsQR from "jsqr";
import * as jpegJs from "jpeg-js";
import { PNG } from "pngjs";
import { childLogger } from "../../lib/logger";

const log = childLogger("qr-decode");

interface RgbaBitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** jsQR needs raw RGBA pixels — a business-card photo arrives as a
 * compressed JPEG/PNG, so it has to be decoded to a bitmap first. Only
 * these two formats are handled (what WhatsApp/Telegram/the dashboard
 * upload actually send); anything else returns null and the caller falls
 * back to the vision model's own (unreliable) read. */
function decodeToBitmap(buffer: Buffer, mimeType: string): RgbaBitmap | null {
  try {
    if (mimeType === "image/png") {
      const png = PNG.sync.read(buffer);
      return { data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength), width: png.width, height: png.height };
    }
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      const jpeg = jpegJs.decode(buffer, { maxResolutionInMP: 100 });
      return { data: new Uint8ClampedArray(jpeg.data.buffer, jpeg.data.byteOffset, jpeg.data.byteLength), width: jpeg.width, height: jpeg.height };
    }
    return null;
  } catch (err) {
    log.warn({ err, mimeType }, "failed to decode image to bitmap for QR scan");
    return null;
  }
}

/** Deterministically decodes a QR code straight from the pixels, instead
 * of asking the vision LLM to read one visually — an LLM's image
 * understanding isn't precise enough to reconstruct a QR's exact bit
 * pattern (and its Reed-Solomon error correction), so it was missing
 * codes a real decoder reads without trouble. Tries both color-polarity
 * assumptions (attemptBoth) since a card's QR can be printed light-on-dark
 * as easily as the usual dark-on-light. Returns null (not a thrown error)
 * on anything from "wrong format" to "no QR actually in this image" — the
 * caller treats that as "nothing found," same as before this existed. */
export function decodeQrFromImage(buffer: Buffer, mimeType: string): string | null {
  const bitmap = decodeToBitmap(buffer, mimeType);
  if (!bitmap) return null;

  const result = jsQR(bitmap.data, bitmap.width, bitmap.height, { inversionAttempts: "attemptBoth" });
  return result?.data || null;
}
