export function ScanVolumeChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-ink">{d.count > 0 ? d.count : ""}</span>
          <div className="flex h-32 w-full items-end">
            <div
              className="w-full rounded-t-sm bg-accent/80"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              title={`${d.date}: ${d.count}`}
            />
          </div>
          <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
