const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Embedded Google Map for an event's geocoded location — Maps Embed API
 * (a plain iframe src, no JS SDK needed). Renders nothing at all when
 * there's no lat/lng (freeform/no location) or no API key configured yet,
 * rather than a "Map preview" placeholder box that used to show
 * unconditionally regardless of whether there was anything to show. */
export function EventMap({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  if (lat == null || lng == null || !MAPS_KEY) return null;

  return (
    <iframe
      title={`Map showing ${label}`}
      className="min-h-24 w-full rounded-xl border border-border sm:col-span-2"
      src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${lat},${lng}&zoom=15`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
