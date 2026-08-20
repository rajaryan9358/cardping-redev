import { notFound } from "next/navigation";
import { EditEventClient } from "./EditEventClient";
import { getEvent } from "@/lib/data/events";

export default async function EditEventPage({ params }: { params: { eventId: string } }) {
  const event = await getEvent(params.eventId);
  if (!event) notFound();
  return <EditEventClient event={event} />;
}
