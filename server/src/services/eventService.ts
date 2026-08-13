import { eventsRepo } from "../db/repositories/events.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { EventRow } from "../types/domain";

export async function setActiveEvent(userId: string, name: string): Promise<EventRow> {
  const event = await eventsRepo.create(userId, name);
  await usersRepo.setActiveEvent(userId, event.id);
  return event;
}
