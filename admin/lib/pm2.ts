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
 * leaving the app running on stale config. */
export async function restartApp(app: AppName): Promise<void> {
  await execAsync(`pm2 restart ${PM2_APP_NAME[app]} --update-env`);
}
