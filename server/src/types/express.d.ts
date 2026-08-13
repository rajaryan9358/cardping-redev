import "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Raw request body bytes, captured by the express.json() `verify`
     * hook in app.ts — needed to check the WhatsApp X-Hub-Signature-256
     * header, which is computed over the exact bytes Meta sent. */
    rawBody?: Buffer;
  }
}
