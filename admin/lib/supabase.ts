import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client, same pattern as server/src/db/client.ts — admin/ talks
// to Supabase directly rather than proxying through server/ (see the
// architecture note in the approved plan: server/ is the internet-facing
// webhook receiver and shouldn't gain admin-shaped capabilities).
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
