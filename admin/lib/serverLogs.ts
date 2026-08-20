import "server-only";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type LogProcessName = "server" | "dashboard" | "admin";

const PM2_NAME: Record<LogProcessName, string> = {
  server: "cardping-server",
  dashboard: "cardping-dashboard",
  admin: "cardping-admin",
};

export interface LogEntry {
  // null when a line couldn't be parsed as pino JSON (e.g. a raw
  // console.warn from a dependency, like Node's own deprecation notices).
  time: number | null;
  level: number | null;
  levelLabel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "unknown";
  msg: string;
  scope: string | null;
  raw: string;
  source: "out" | "error";
}

const LEVEL_LABELS: Record<number, LogEntry["levelLabel"]> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

function parseLine(raw: string, source: LogEntry["source"]): LogEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const obj = JSON.parse(trimmed);
    const level = typeof obj.level === "number" ? obj.level : null;
    return {
      time: typeof obj.time === "number" ? obj.time : null,
      level,
      levelLabel: level !== null ? LEVEL_LABELS[level] ?? "unknown" : "unknown",
      msg: typeof obj.msg === "string" ? obj.msg : trimmed,
      scope: typeof obj.scope === "string" ? obj.scope : null,
      raw: trimmed,
      source,
    };
  } catch {
    // Not JSON — a dependency's raw stdout/stderr write (deprecation
    // warnings, stack traces printed outside pino). Still worth showing,
    // just without structured fields.
    return { time: null, level: null, levelLabel: "unknown", msg: trimmed, scope: null, raw: trimmed, source };
  }
}

/** Resolves the CURRENT log file paths for a pm2 process by name rather
 * than assuming a fixed filename — pm2 suffixes the log filename with the
 * process's numeric pm_id, which changes across a `pm2 delete` + `pm2
 * start` (as opposed to a plain `pm2 restart`, which keeps the same id
 * and file). */
async function getLogPaths(app: LogProcessName): Promise<{ out: string; err: string }> {
  const { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL } = process.env;
  const { stdout } = await execAsync("pm2 jlist", { env: { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL }, maxBuffer: 10 * 1024 * 1024 });
  const processes = JSON.parse(stdout) as { name: string; pm2_env: { pm_out_log_path: string; pm_err_log_path: string } }[];
  const proc = processes.find((p) => p.name === PM2_NAME[app]);
  if (!proc) throw new Error(`pm2 process "${PM2_NAME[app]}" not found`);
  return { out: proc.pm2_env.pm_out_log_path, err: proc.pm2_env.pm_err_log_path };
}

async function readTail(filePath: string, maxLines: number): Promise<string[]> {
  const { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL } = process.env;
  try {
    const { stdout } = await execAsync(`tail -n ${maxLines} ${JSON.stringify(filePath)}`, {
      env: { NODE_ENV, PATH, HOME, USER, LOGNAME, SHELL },
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.split("\n");
  } catch {
    // File may not exist yet (a process that's never logged to stderr,
    // for instance) — an empty tail, not a page-breaking error.
    return [];
  }
}

/** Most-recent-first, merged across stdout+stderr, capped at maxLines
 * total (not per-file) so the page stays fast regardless of how much
 * louder one stream is than the other. */
export async function getRecentLogs(app: LogProcessName, maxLines = 300): Promise<LogEntry[]> {
  const paths = await getLogPaths(app);
  const [outLines, errLines] = await Promise.all([readTail(paths.out, maxLines), readTail(paths.err, maxLines)]);

  const entries = [
    ...outLines.map((l) => parseLine(l, "out" as const)),
    ...errLines.map((l) => parseLine(l, "error" as const)),
  ].filter((e): e is LogEntry => e !== null);

  entries.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return entries.slice(0, maxLines);
}
