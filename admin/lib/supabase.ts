import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "./env";

// Service-role client, same pattern as server/src/db/client.ts — admin/ talks
// to Supabase directly rather than proxying through server/ (see the
// architecture note in the approved plan: server/ is the internet-facing
// webhook receiver and shouldn't gain admin-shaped capabilities).
// The `ws` transport is required on Node <22, which has no native
// WebSocket global — supabase-js's realtime client otherwise throws at
// construction time even though this app never subscribes to anything.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- realtime-js's WebSocketLikeConstructor type doesn't line up with ws's, but the shapes are compatible at runtime
  realtime: { transport: WebSocket as any },
});
