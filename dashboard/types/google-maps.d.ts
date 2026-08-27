// Minimal ambient types for the small slice of the Google Maps JS API this
// app actually uses (Places Autocomplete on the event location field) —
// avoids pulling in the full @types/google.maps package for three methods.
declare namespace google.maps.places {
  interface PlaceResult {
    formatted_address?: string;
    geometry?: {
      location?: {
        lat(): number;
        lng(): number;
      };
    };
  }

  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: { fields?: string[] });
    addListener(event: "place_changed", handler: () => void): void;
    getPlace(): PlaceResult;
  }
}
