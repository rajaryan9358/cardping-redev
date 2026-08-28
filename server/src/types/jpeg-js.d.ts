// jpeg-js ships no type declarations of its own — minimal shape for the
// one function this codebase actually calls (see integrations/qr/decode.ts).
declare module "jpeg-js" {
  export interface RawImageData {
    width: number;
    height: number;
    data: Uint8Array | Buffer;
  }

  export function decode(jpegData: Buffer | Uint8Array, options?: { maxResolutionInMP?: number; maxMemoryUsageInMB?: number }): RawImageData;
}
