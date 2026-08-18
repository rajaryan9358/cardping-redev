"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { appEnvFiles, AppName, EnvVarEntry, maskValue } from "../../../lib/appEnvFiles";
import { restartApp } from "../../../lib/pm2";
import { writeAuditLog } from "../../../lib/auditLog";

export interface UpdateEnvVarState {
  error: string | null;
}

/** Fetches every key's real value at once for "Reveal & edit all" — same
 * on-demand-only, audited-access pattern as revealEnvVarAction, just for
 * the whole file in one call instead of one key. */
export async function revealAllEnvEntriesAction(app: AppName): Promise<EnvVarEntry[]> {
  const admin = await requireAdmin();
  const entries = await appEnvFiles.readEnvFile(app);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "env.reveal_all",
    targetTable: `${app}/.env`,
  });
  return entries;
}

/** Saves every changed key from "Reveal & edit all" in one action —
 * unchanged keys are never touched, so comments/ordering for the rest of
 * the file stay exactly as they were (appEnvFiles.writeEnvValue rewrites
 * one line at a time). One audit log row per changed key (masked value,
 * same as updateEnvVarAction — the log must never become a place secrets
 * leak from), then a single restart once all changes are written. */
export async function updateChangedEnvVarsAction(
  app: AppName,
  changes: { key: string; value: string }[],
): Promise<UpdateEnvVarState> {
  const admin = await requireAdmin();
  if (changes.length === 0) return { error: null };
  if (changes.some((c) => !c.value)) return { error: "Values can't be empty." };

  try {
    for (const change of changes) {
      await appEnvFiles.writeEnvValue(app, change.key, change.value);
      await writeAuditLog({
        adminUserId: admin.id,
        action: "env.update",
        targetTable: `${app}/.env`,
        targetId: change.key,
        detail: { newValueMasked: maskValue(change.value) },
      });
    }
    await restartApp(app);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update and restart." };
  }

  revalidatePath("/env");
  return { error: null };
}

/** Fetches one variable's raw value on demand, only when the admin clicks
 * Reveal — never shipped to the client otherwise. Logged like any other
 * access to a secret. */
export async function revealEnvVarAction(app: AppName, key: string): Promise<string> {
  const admin = await requireAdmin();
  const value = await appEnvFiles.readEnvValue(app, key);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "env.reveal",
    targetTable: `${app}/.env`,
    targetId: key,
  });
  return value ?? "";
}

/** Writes the new value to the target app's .env, restarts its pm2
 * process so the change takes effect, and logs the edit — the audit log
 * only ever stores a masked form of the new value, never the raw secret,
 * so the log itself can't become a place secrets leak from. */
export async function updateEnvVarAction(
  app: AppName,
  key: string,
  newValue: string,
): Promise<UpdateEnvVarState> {
  const admin = await requireAdmin();
  if (!newValue) return { error: "Value can't be empty." };

  try {
    await appEnvFiles.writeEnvValue(app, key, newValue);
    await writeAuditLog({
      adminUserId: admin.id,
      action: "env.update",
      targetTable: `${app}/.env`,
      targetId: key,
      detail: { newValueMasked: maskValue(newValue) },
    });
    await restartApp(app);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update and restart." };
  }

  revalidatePath("/env");
  return { error: null };
}
