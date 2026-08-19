import { Router } from "express";
import { z } from "zod";
import { visitingCardsRepo } from "../../db/repositories/visitingCards.repo";
import { requireSession } from "../../middleware/requireSession";
import { requireActivePlanOrTrial } from "../../middleware/requireActivePlanOrTrial";
import { resolveUsersIds } from "../../services/accountScope";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const cardsRouter = Router();
const log = childLogger("api-cards-route");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 1000; // ScansExplorer fetches the full set and paginates/filters client-side

cardsRouter.get("/cards", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
    const filters = {
      query: typeof req.query.q === "string" ? req.query.q : undefined,
      eventId: typeof req.query.eventId === "string" ? req.query.eventId : undefined,
      tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
      archived: req.query.archived === "true" ? true : req.query.archived === "false" ? false : undefined,
    };
    const { cards, total } = await visitingCardsRepo.listForAccount(usersIds, filters, page, pageSize);
    res.json({ cards, total, page, pageSize });
  } catch (err) {
    log.error({ err }, "list cards failed");
    res.status(500).json({ error: "list_cards_failed" });
  }
});

// Registered before /cards/:id so "export.csv" never matches as an id.
cardsRouter.get("/cards/export.csv", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const { cards } = await visitingCardsRepo.listForAccount(usersIds, {}, 1, 10_000);

    const columns: (keyof (typeof cards)[number])[] = [
      "full_name",
      "position",
      "company_name",
      "business_email",
      "personal_email",
      "phone1",
      "phone2",
      "website",
      "address",
      "linkedin",
      "created_at",
    ] as any;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = columns.join(",");
    const rows = cards.map((c: any) => columns.map((col) => escape(c[col])).join(","));

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="cardping-contacts.csv"');
    res.send([header, ...rows].join("\n"));
  } catch (err) {
    log.error({ err }, "export cards failed");
    res.status(500).json({ error: "export_failed" });
  }
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1),
  addTags: z.array(z.string()).optional(),
  eventId: z.string().optional(),
  archived: z.boolean().optional(),
});

// Registered before /cards/:id for the same reason as export.csv above.
cardsRouter.patch("/cards/bulk", requireSession, requireActivePlanOrTrial, async (req, res) => {
  const body = parseBody(bulkUpdateSchema, req, res);
  if (!body) return;

  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    if (body.addTags?.length) await visitingCardsRepo.bulkAddTagsForAccount(body.ids, usersIds, body.addTags);
    const patch: { event_id?: string; archived?: boolean } = {};
    if (body.eventId) patch.event_id = body.eventId;
    if (body.archived !== undefined) patch.archived = body.archived;
    if (Object.keys(patch).length > 0) await visitingCardsRepo.bulkUpdateForAccount(body.ids, usersIds, patch);
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "bulk update cards failed");
    res.status(500).json({ error: "bulk_update_failed" });
  }
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1) });

cardsRouter.delete("/cards/bulk", requireSession, requireActivePlanOrTrial, async (req, res) => {
  const body = parseBody(bulkDeleteSchema, req, res);
  if (!body) return;

  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    await visitingCardsRepo.bulkDeleteForAccount(body.ids, usersIds);
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "bulk delete cards failed");
    res.status(500).json({ error: "bulk_delete_failed" });
  }
});

cardsRouter.get("/cards/:id", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const card = await visitingCardsRepo.findByIdForAccount(req.params.id, usersIds);
    if (!card) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ card });
  } catch (err) {
    log.error({ err }, "get card failed");
    res.status(500).json({ error: "get_card_failed" });
  }
});

const updateSchema = z.object({
  fullName: z.string().optional(),
  jobTitle: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  businessEmail: z.string().nullable().optional(),
  personalEmail: z.string().nullable().optional(),
  phone1: z.string().nullable().optional(),
  phone2: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  transcribedNote: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  eventId: z.string().optional(),
});

cardsRouter.patch("/cards/:id", requireSession, requireActivePlanOrTrial, async (req, res) => {
  const body = parseBody(updateSchema, req, res);
  if (!body) return;

  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const card = await visitingCardsRepo.updateForAccount(req.params.id, usersIds, {
      full_name: body.fullName,
      position: body.jobTitle,
      company_name: body.companyName,
      business_email: body.businessEmail,
      personal_email: body.personalEmail,
      phone1: body.phone1,
      phone2: body.phone2,
      website: body.website,
      address: body.address,
      linkedin: body.linkedin,
      twitter: body.twitter,
      facebook: body.facebook,
      instagram: body.instagram,
      transcribed_note: body.transcribedNote,
      tags: body.tags,
      archived: body.archived,
      event_id: body.eventId,
    });
    if (!card) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ card });
  } catch (err) {
    log.error({ err }, "update card failed");
    res.status(500).json({ error: "update_card_failed" });
  }
});

cardsRouter.delete("/cards/:id", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    await visitingCardsRepo.deleteForAccount(req.params.id, usersIds);
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "delete card failed");
    res.status(500).json({ error: "delete_card_failed" });
  }
});
