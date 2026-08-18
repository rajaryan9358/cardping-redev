import { promises as fs } from "fs";
import path from "path";
import { env } from "./env";

export type AppName = "server" | "dashboard";

export interface EnvVarEntry {
  key: string;
  value: string;
}

function pathFor(app: AppName): string {
  const raw = app === "server" ? env.SERVER_ENV_PATH : env.DASHBOARD_ENV_PATH;
  return path.resolve(process.cwd(), raw);
}

const LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/** Strips a trailing ` # comment` from an unquoted value — several
 * .env.example-style files in this repo mark still-blank required vars as
 * `KEY= # REQUIRED — ...`, and without this the placeholder note itself
 * was being read (and masked/displayed) as if it were the value. */
function stripInlineComment(rawValue: string): string {
  const hashIndex = rawValue.indexOf(" #");
  return (hashIndex === -1 ? rawValue : rawValue.slice(0, hashIndex)).trim();
}

/** Parses a dotenv-style file into ordered key/value entries. Comment and
 * blank lines are dropped — this app only ever needs the variables
 * themselves, never round-trips comments. */
async function readEnvFile(app: AppName): Promise<EnvVarEntry[]> {
  const raw = await fs.readFile(pathFor(app), "utf-8");
  const entries: EnvVarEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = LINE_RE.exec(trimmed);
    if (!match) continue;
    entries.push({ key: match[1], value: stripInlineComment(match[2]) });
  }
  return entries;
}

/** Masks a secret for display: last 4 characters visible, rest replaced.
 * Values of 4 characters or fewer are masked entirely so nothing short
 * enough to guess ever renders. */
export function maskValue(value: string): string {
  if (value.length <= 4) return "•".repeat(Math.max(value.length, 4));
  return "•".repeat(value.length - 4) + value.slice(-4);
}

/** Rewrites a single key's value in place, preserving every other line
 * exactly (comments, ordering, blank lines). Appends a new line if the key
 * doesn't already exist. Used by the Env Variables screen's Save action —
 * callers are responsible for the audit log write and the pm2 restart. */
async function writeEnvValue(app: AppName, key: string, newValue: string): Promise<void> {
  const filePath = pathFor(app);
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");

  let found = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) return line;
    const match = LINE_RE.exec(trimmed);
    if (match && match[1] === key) {
      found = true;
      return `${key}=${newValue}`;
    }
    return line;
  });

  if (!found) {
    if (updated[updated.length - 1] === "") updated.pop();
    updated.push(`${key}=${newValue}`, "");
  }

  await fs.writeFile(filePath, updated.join("\n"), "utf-8");
}

/** Reads one variable's raw (unmasked) value — used server-side only, by the
 * vision re-run and broadcast send clients, never sent to the browser. */
async function readEnvValue(app: AppName, key: string): Promise<string | null> {
  const entries = await readEnvFile(app);
  return entries.find((entry) => entry.key === key)?.value ?? null;
}

export const appEnvFiles = {
  readEnvFile,
  writeEnvValue,
  readEnvValue,
};
