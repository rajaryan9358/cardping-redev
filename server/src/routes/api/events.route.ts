import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { eventsRepo } from "../../db/repositories/events.repo";
import { supabaseStorage } from "../../integrations/storage/supabaseStorage";
import { requireSession } from "../../middleware/requireSession";
import { requireActivePlanOrTrial } from "../../middleware/requireActivePlanOrTrial";
import { resolveUsersIds } from "../../services/accountScope";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const eventsRouter = Router();
const log = childLogger("api-events-route");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

eventsRouter.get("/events", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const events = await eventsRepo.listForAccount(usersIds);
    const withLeadCounts = await Promise.all(
      events.map(async (event) => ({ ...event, leadCount: await eventsRepo.countCardsForEvent(event.id, usersIds) })),
    );
    res.json({ events: withLeadCounts });
  } catch (err) {
    log.error({ err }, "list events failed");
    res.status(500).json({ error: "list_events_failed" });
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
});

// An event organizes scans, and scans only ever happen via a linked
// WhatsApp/Telegram channel — so creating one from the dashboard needs at
// least one linked channel to attach it to (same account-scoping
// mechanism as cards). A brand-new account that skipped channel linking
// during onboarding gets a clear error here, not a silently orphaned event.
eventsRouter.post("/events", requireSession, requireActivePlanOrTrial, async (req, res) => {
  const body = parseBody(createSchema, req, res);
  if (!body) return;

  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    if (usersIds.length === 0) {
      res.status(400).json({ error: "no_channel_linked" });
      return;
    }
    const event = await eventsRepo.createForUsersId(usersIds[0], {
      name: body.name,
      location: body.location,
      event_date: body.eventDate,
    });
    res.json({ event: { ...event, leadCount: 0 } });
  } catch (err) {
    log.error({ err }, "create event failed");
    res.status(500).json({ error: "create_event_failed" });
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
});

eventsRouter.patch("/events/:id", requireSession, requireActivePlanOrTrial, async (req, res) => {
  const body = parseBody(updateSchema, req, res);
  if (!body) return;

  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const event = await eventsRepo.updateForAccount(req.params.id, usersIds, {
      name: body.name,
      location: body.location,
      event_date: body.eventDate,
    });
    if (!event) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const leadCount = await eventsRepo.countCardsForEvent(event.id, usersIds);
    res.json({ event: { ...event, leadCount } });
  } catch (err) {
    log.error({ err }, "update event failed");
    res.status(500).json({ error: "update_event_failed" });
  }
});

eventsRouter.post("/events/:id/thumbnail", requireSession, requireActivePlanOrTrial, upload.single("thumbnail"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "no_file" });
    return;
  }
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const existing = await eventsRepo.findByIdForAccount(req.params.id, usersIds);
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { path, publicUrl } = await supabaseStorage.uploadEventThumbnail(
      req.params.id,
      req.file.buffer,
      req.file.mimetype,
    );
    const event = await eventsRepo.updateForAccount(req.params.id, usersIds, {
      thumbnail_path: path,
      thumbnail_public_url: publicUrl,
    });
    res.json({ event });
  } catch (err) {
    log.error({ err }, "event thumbnail upload failed");
    res.status(500).json({ error: "thumbnail_upload_failed" });
  }
});

eventsRouter.get("/events/:id", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const event = await eventsRepo.findByIdForAccount(req.params.id, usersIds);
    if (!event) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const leadCount = await eventsRepo.countCardsForEvent(event.id, usersIds);
    res.json({ event: { ...event, leadCount } });
  } catch (err) {
    log.error({ err }, "get event failed");
    res.status(500).json({ error: "get_event_failed" });
  }
});
