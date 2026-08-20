import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env";
import { resilientSupabaseFetch } from "./resilientFetch";

// Service-role client — this process is a trusted backend, so it bypasses
// row-level security by design. Never forward this key to a client app.
// The `ws` transport is required on Node <22, which has no native
// WebSocket global — supabase-js's realtime client otherwise throws at
// construction time even though this app never subscribes to anything.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- realtime-js's WebSocketLikeConstructor type doesn't line up with ws's, but the shapes are compatible at runtime
  realtime: { transport: WebSocket as any },
  global: { fetch: resilientSupabaseFetch },
});
