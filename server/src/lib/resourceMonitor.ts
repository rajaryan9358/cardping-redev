import { monitorEventLoopDelay } from "node:perf_hooks";
import { childLogger } from "./logger";
import { sendOpsAlert } from "./opsAlert";

const log = childLogger("resource-monitor");

// A blocked/lagging event loop is the single most common cause of "the
// server feels slow" on a single-process Node app like this one (see the
// investigation that led here) — every request queues behind whatever's
// hogging the loop. RSS is the other cheap signal worth a timeline: this
// process's PM2 max_memory_restart is 768MB, so 600MB is "getting close,"
// not yet an emergency.
const EVENT_LOOP_LAG_WARN_MS = 200;
const RSS_WARN_MB = 600;

export function startResourceMonitor(intervalMs = 60_000): void {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  setInterval(() => {
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    // Histogram values are nanoseconds.
    const eventLoopLagMeanMs = Math.round(histogram.mean / 1e6);
    const eventLoopLagMaxMs = Math.round(histogram.max / 1e6);

    const underPressure = eventLoopLagMeanMs > EVENT_LOOP_LAG_WARN_MS || rssMb > RSS_WARN_MB;
    const snapshot = { rssMb, heapUsedMb, eventLoopLagMeanMs, eventLoopLagMaxMs };
    if (underPressure) {
      log.warn(snapshot, "resource snapshot — under pressure");
      void sendOpsAlert(
        "resource-pressure",
        `⚠️ CardPing server under pressure — RSS ${rssMb}MB, event loop lag ${eventLoopLagMeanMs}ms mean / ${eventLoopLagMaxMs}ms max`,
      );
    } else {
      log.info(snapshot, "resource snapshot");
    }

    histogram.reset();
  }, intervalMs).unref();
}
