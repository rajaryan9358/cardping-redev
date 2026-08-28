import "server-only";
import jsQR from "jsqr";
import * as jpegJs from "jpeg-js";
import { PNG } from "pngjs";

// Duplicated from server/src/integrations/qr/decode.ts on purpose — same
// reasoning as vision.ts's own header comment (admin/ never imports from
// server/ or shares its process). Keep the two in sync by hand.

interface RgbaBitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** jsQR needs raw RGBA pixels — a business-card photo arrives as a
 * compressed JPEG/PNG, so it has to be decoded to a bitmap first. Only
 * these two formats are handled (what the stored card images actually
 * are); anything else returns null and the caller falls back to the
 * vision model's own (unreliable) read. */
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
    console.warn("[qrDecode] failed to decode image to bitmap for QR scan", { mimeType, err });
    return null;
  }
}

/** Deterministically decodes a QR code straight from the pixels, instead
 * of relying on the vision LLM to read one visually — see
 * server/src/integrations/qr/decode.ts's fuller explanation. Tries both
 * color-polarity assumptions (attemptBoth). Returns null (not a thrown
 * error) whenever nothing is found — the caller treats that as "keep the
 * model's own read," same as before this existed. */
export function decodeQrFromImage(buffer: Buffer, mimeType: string): string | null {
  const bitmap = decodeToBitmap(buffer, mimeType);
  if (!bitmap) return null;

  const result = jsQR(bitmap.data, bitmap.width, bitmap.height, { inversionAttempts: "attemptBoth" });
  return result?.data || null;
}
