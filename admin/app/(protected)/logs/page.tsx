import { getRecentLogs, LogProcessName } from "../../../lib/serverLogs";
import { LogsClient } from "./LogsClient";

const VALID_PROCESSES: LogProcessName[] = ["server", "dashboard", "admin"];
const MAX_LINES = 500;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { process?: string };
}) {
  const process: LogProcessName = VALID_PROCESSES.includes(searchParams.process as LogProcessName)
    ? (searchParams.process as LogProcessName)
    : "server";

  let logs: Awaited<ReturnType<typeof getRecentLogs>> = [];
  let error: string | null = null;
  try {
    logs = await getRecentLogs(process, MAX_LINES);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to read logs.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Logs</h1>
        <p className="mt-1 text-sm text-muted">Last {MAX_LINES} lines from each process, newest first.</p>
      </div>
      <LogsClient logs={logs} process={process} error={error} />
    </div>
  );
}
