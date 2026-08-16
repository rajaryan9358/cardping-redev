import { mockEvents } from "../mock/events";
import { EventRecord } from "../types";

export async function getEvents(): Promise<EventRecord[]> {
  return mockEvents;
}

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  return mockEvents.find((e) => e.id === eventId) ?? null;
}
