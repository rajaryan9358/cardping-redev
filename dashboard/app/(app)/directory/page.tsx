import { ScansExplorer } from "@/components/scans/ScansExplorer";
import { allTags, getCards } from "@/lib/data/cards";
import { getEvents } from "@/lib/data/events";

export default async function DirectoryPage({ searchParams }: { searchParams: { query?: string } }) {
  const [cards, events] = await Promise.all([getCards(), getEvents()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">Directory</h1>
        <p className="text-sm text-muted">Search, filter, and manage every contact you&apos;ve scanned.</p>
      </div>
      <ScansExplorer initialCards={cards} events={events} allTags={allTags(cards)} initialQuery={searchParams.query ?? ""} />
    </div>
  );
}
