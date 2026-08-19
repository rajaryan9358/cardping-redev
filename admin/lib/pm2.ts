import { exec } from "child_process";
import { promisify } from "util";
import { AppName } from "./appEnvFiles";

const execAsync = promisify(exec);

const PM2_APP_NAME: Record<AppName, string> = {
  server: "cardping-server",
  dashboard: "cardping-dashboard",
};

/** Restarts a sibling app's pm2 process after an env var edit, picking up
 * .env changes (pm2's own process doesn't reread .env on its own). Throws
 * on failure — callers surface this to the admin rather than silently
 * leaving the app running on stale config.
 *
 * `--update-env` makes pm2 recapture whatever environment the CALLING
 * shell has as the target process's new saved env — and by default
 * child_process.exec inherits this admin process's own full environment,
 * including its own PORT=3200 (see ecosystem.config.js). Since dotenv only
 * sets a var if it isn't already present, that leaked PORT would silently
 * win over the target app's real PORT from its own .env, and it would try
 * to bind 3200 — colliding with admin itself and crash-looping the
 * restarted app. Passing a minimal, admin-agnostic env here is what
 * prevents that leak; do not switch this back to inheriting process.env. */
export async function restartApp(app: AppName): Promise<void> {
  const { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL } = process.env;
  await execAsync(`pm2 restart ${PM2_APP_NAME[app]} --update-env`, {
    env: { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL },
  });
}
