"use client";

import { useEffect, useRef, useState } from "react";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let scriptLoadPromise: Promise<void> | null = null;

function loadPlacesScript(): Promise<void> {
  if (!MAPS_KEY) return Promise.reject(new Error("no_maps_key"));
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("maps_script_failed"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

/** Location input for the event create/edit forms. Uses Google Places
 * Autocomplete to resolve a picked place to a formatted address + lat/lng
 * (submitted as hidden fields alongside the visible text input, so the
 * surrounding form's existing FormData-based submit needs no other
 * changes). Degrades to a plain text input — same as before this
 * existed — when no Maps API key is configured yet. */
export function LocationAutocompleteInput({
  defaultValue,
  defaultLat,
  defaultLng,
}: {
  defaultValue?: string | null;
  defaultLat?: number | null;
  defaultLng?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [location, setLocation] = useState(defaultValue ?? "");
  const [lat, setLat] = useState<number | null>(defaultLat ?? null);
  const [lng, setLng] = useState<number | null>(defaultLng ?? null);

  useEffect(() => {
    if (!MAPS_KEY || !inputRef.current) return;
    let autocomplete: google.maps.places.Autocomplete | undefined;
    loadPlacesScript()
      .then(() => {
        if (!inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, { fields: ["formatted_address", "geometry"] });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete!.getPlace();
          setLocation(place.formatted_address ?? inputRef.current?.value ?? "");
          setLat(place.geometry?.location?.lat() ?? null);
          setLng(place.geometry?.location?.lng() ?? null);
        });
      })
      .catch(() => {
        /* stays a plain text input on failure */
      });
  }, []);

  return (
    <>
      <input
        ref={inputRef}
        name="location"
        placeholder="e.g., Moscone Center"
        value={location}
        onChange={(e) => {
          setLocation(e.target.value);
          setLat(null);
          setLng(null);
        }}
        className="rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />
    </>
  );
}
