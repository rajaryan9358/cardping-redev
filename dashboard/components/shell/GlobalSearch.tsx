"use client";

import { Calendar, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { clientFetch } from "@/lib/clientFetch";
import { Channel } from "@/lib/types";

interface CardResult {
  id: string;
  full_name: string | null;
  company_name: string | null;
  uploaded_by: Channel | null;
}

interface EventResult {
  id: string;
  name: string;
  event_date: string | null;
  status: "active" | "inactive";
}

const DEBOUNCE_MS = 250;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<CardResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setCards([]);
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [cardsRes, eventsRes] = await Promise.all([
          clientFetch(`/api/cards?q=${encodeURIComponent(trimmed)}&pageSize=5`),
          clientFetch(`/api/events?q=${encodeURIComponent(trimmed)}`),
        ]);
        const cardsData = cardsRes.ok ? ((await cardsRes.json()).cards as CardResult[]) : [];
        const eventsData = eventsRes.ok ? ((await eventsRes.json()).events as EventResult[]) : [];
        setCards(cardsData.slice(0, 5));
        setEvents(eventsData.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const trimmed = query.trim();
  const hasResults = cards.length > 0 || events.length > 0;
  const showDropdown = open && trimmed.length > 0;

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-xs sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={2} />
      <input
        type="text"
        placeholder="Search cards and events..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full rounded-lg border border-border bg-surface-warm py-2 pl-9 pr-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {trimmed && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-96 w-full min-w-[320px] overflow-y-auto rounded-xl border border-border bg-surface shadow-soft">
          {loading && <p className="px-4 py-6 text-center text-sm text-muted">Searching...</p>}
          {!loading && !hasResults && <p className="px-4 py-6 text-center text-sm text-muted">No matches for "{trimmed}"</p>}

          {!loading && cards.length > 0 && (
            <div className="border-b border-border py-2 last:border-0">
              <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Cards</p>
              {cards.map((card) => (
                <a
                  key={card.id}
                  href={`/directory/${card.id}`}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-active-bg"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                    {initials(card.full_name ?? "?")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{card.full_name ?? "Unknown"}</span>
                    {card.company_name && <span className="truncate text-xs text-muted">{card.company_name}</span>}
                  </span>
                  <ChannelIcon channel={card.uploaded_by} size={18} />
                </a>
              ))}
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="py-2">
              <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Events</p>
              {events.map((event) => (
                <a key={event.id} href={`/events/${event.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-active-bg">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                    <Calendar className="size-4" strokeWidth={2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{event.name}</span>
                    {event.event_date && (
                      <span className="text-xs text-muted">
                        {new Date(event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      event.status === "active" ? "bg-success-bg text-success-text" : "bg-active-bg text-muted-2"
                    }`}
                  >
                    {event.status === "active" ? "Active" : "Inactive"}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
