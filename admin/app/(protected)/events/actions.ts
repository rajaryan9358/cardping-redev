"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../../../lib/auth";
import { adminEventsRepo } from "../../../lib/repositories/adminEvents.repo";
import { writeAuditLog } from "../../../lib/auditLog";

export interface EventPatch {
  name?: string;
  location?: string | null;
  event_date?: string | null;
  status?: "active" | "inactive";
}

export async function updateEventAction(eventId: string, patch: EventPatch): Promise<void> {
  const admin = await requireAdmin();
  await adminEventsRepo.updateEvent(eventId, patch);
  await writeAuditLog({ adminUserId: admin.id, action: "event.update", targetTable: "events", targetId: eventId, detail: patch });
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

export async function uploadEventThumbnailAction(eventId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) throw new Error("No file provided.");
  const buffer = Buffer.from(await file.arrayBuffer());
  await adminEventsRepo.uploadThumbnail(eventId, buffer, file.type || "image/jpeg");
  await writeAuditLog({ adminUserId: admin.id, action: "event.update_thumbnail", targetTable: "events", targetId: eventId });
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

/** `alsoDeleteCards` is a real choice — visiting_cards.event_id is ON
 * DELETE SET NULL, so by default deleting an event just orphans its cards
 * (they survive). See adminEventsRepo.deleteEvent's comment. */
export async function deleteEventAction(eventId: string, alsoDeleteCards: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminEventsRepo.deleteEvent(eventId, alsoDeleteCards);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "event.delete",
    targetTable: "events",
    targetId: eventId,
    detail: { alsoDeleteCards },
  });
  revalidatePath("/events");
  revalidatePath("/cards");
}

export async function bulkDeleteEventsAction(eventIds: string[], alsoDeleteCards: boolean): Promise<void> {
  const admin = await requireAdmin();
  await adminEventsRepo.bulkDeleteEvents(eventIds, alsoDeleteCards);
  await writeAuditLog({
    adminUserId: admin.id,
    action: "event.bulk_delete",
    targetTable: "events",
    detail: { eventIds, alsoDeleteCards },
  });
  revalidatePath("/events");
  revalidatePath("/cards");
}
