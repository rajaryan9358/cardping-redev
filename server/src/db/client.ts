import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

// Service-role client — this process is a trusted backend, so it bypasses
// row-level security by design. Never forward this key to a client app.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
