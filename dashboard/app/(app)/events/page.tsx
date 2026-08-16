import { EventsClient } from "./EventsClient";
import { getEvents } from "@/lib/data/events";

export default async function EventsPage() {
  const events = await getEvents();
  return <EventsClient events={events} />;
}
