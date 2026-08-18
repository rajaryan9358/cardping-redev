// Node-only half of instrumentation.ts's register() — split into its own
// module so the Edge bundle never has to resolve fs/path/the Supabase
// client. This file is only ever reached via instrumentation.ts's
// NEXT_RUNTIME==='nodejs' branch, so plain static imports are fine here —
// no need for another dynamic import.
import { env } from "./lib/env";
import { runNotificationChecks } from "./lib/notificationChecks";

let started = false;

// Next's dev-mode module reloading can call register() more than once;
// this guard keeps the interval singular for the process's lifetime.
if (!started) {
  started = true;

  const intervalMs = env.NOTIFICATION_CHECK_INTERVAL_MINUTES * 60 * 1000;

  const tick = () => {
    runNotificationChecks().catch((error) => {
      console.error("[notification-scheduler] check failed", error);
    });
  };

  tick();
  setInterval(tick, intervalMs);
}
