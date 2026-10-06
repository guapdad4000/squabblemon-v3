import { getAuth } from "@clerk/express";
import {
  CreateAdminPatchBody,
  CreateAdminPatchResponse,
  ListAdminPatchesResponse,
  ListPublishedPatchesResponse,
  PreviewAdminPatchParams,
  PreviewAdminPatchResponse,
  PublishAdminPatchBody,
  PublishAdminPatchParams,
  PublishAdminPatchResponse,
  ResumeAdminPatchDeliveryParams,
  ResumeAdminPatchDeliveryResponse,
  UpdateAdminPatchBody,
  UpdateAdminPatchParams,
  UpdateAdminPatchResponse,
} from "@workspace/api-zod";
import { Router } from "express";
import {
  createPatchDraft,
  getAdminPatch,
  listAdminPatches,
  listPublicPatches,
  previewPatch,
  processPatchDeliveryBatch,
  publishPatch,
  updatePatchDraft,
} from "../lib/patches";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { catalogCardById } from "@workspace/squabblemon-engine/data";

const router = Router();

function adminId(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): string | undefined {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (userId === "e2e-player") {
    res.status(403).json({ error: "Patch administration is not enabled for this account." });
    return;
  }
  const allowed = (process.env.PATCH_ADMIN_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.length || !allowed.includes(userId)) {
    res.status(403).json({ error: "Patch administration is not enabled for this account." });
    return;
  }
  return userId;
}

function isSameOrigin(req: Parameters<Parameters<typeof router.get>[1]>[0]): boolean {
  const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") return false;

  const host = getClerkProxyHost(req);
  if (!host) return false;
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedProtocol = forwardedProto || req.protocol;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(`${expectedProtocol}://${host}`).origin;
  } catch {
    return false;
  }

  const origin = req.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === expectedOrigin;
    } catch {
      return false;
    }
  }
  if (fetchSite === "same-origin") return true;
  const referer = req.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function authorizeMutation(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): string | undefined {
  if (!isSameOrigin(req)) {
    res.status(403).json({ error: "Same-origin request required." });
    return;
  }
  return adminId(req, res);
}

function normalizedInput(data: {
  version: string; title: string; date: string; overview: string;
  buffs: string[]; changes: string[]; softCurrency?: number; packTickets?: number; artCardId?: string | null;
}) {
  return {
    ...data,
    softCurrency: data.softCurrency ?? 50,
    packTickets: data.packTickets ?? 0,
    artCardId: data.artCardId ?? null,
  };
}

/** Patch art must be an original catalog character portrait, never a support or token. */
function validArtCard(id: string | null): boolean {
  if (id === null) return true;
  if (!Object.hasOwn(catalogCardById, id)) return false;
  const card = catalogCardById[id];
  return card.kind !== "support" && card.kind !== "token";
}

function validTextContent(input: ReturnType<typeof normalizedInput>): boolean {
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
    Number.isFinite(Date.parse(`${input.date}T00:00:00.000Z`)) &&
    new Date(`${input.date}T00:00:00.000Z`).toISOString().slice(0, 10) === input.date;
  const letterBody = [
    `Patch ${input.version} · ${new Date(`${input.date}T00:00:00.000Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}`,
    input.title,
    "",
    input.overview,
    ...(input.buffs.length ? ["", "Buffs", ...input.buffs.map(item => `• ${item}`)] : []),
    ...(input.changes.length ? ["", "Changes", ...input.changes.map(item => `• ${item}`)] : []),
  ].join("\n");
  return Number.isSafeInteger(input.packTickets) && Number.isSafeInteger(input.softCurrency) &&
    calendarDate && !!input.version.trim() && !!input.title.trim() && !!input.overview.trim() &&
    `Patch ${input.version}: ${input.title}`.length <= 120 &&
    input.buffs.every(item => !!item.trim()) && input.changes.every(item => !!item.trim()) && letterBody.length <= 6000 &&
    validArtCard(input.artCardId);
}

router.get("/events/patches", async (_req, res): Promise<void> => {
  try {
    res.json(ListPublishedPatchesResponse.parse(await listPublicPatches()));
  } catch {
    res.status(503).json({ error: "Published patches are unavailable. Please retry." });
  }
});

router.get("/admin/patches", async (req, res): Promise<void> => {
  if (!adminId(req, res)) return;
  try {
    res.json(ListAdminPatchesResponse.parse(await listAdminPatches()));
  } catch {
    res.status(503).json({ error: "Patch drafts are unavailable. Please retry." });
  }
});

router.post("/admin/patches", async (req, res): Promise<void> => {
  const userId = authorizeMutation(req, res);
  if (!userId) return;
  const parsed = CreateAdminPatchBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patch draft." });
    return;
  }
  const input = normalizedInput(parsed.data);
  if (!validTextContent(input)) {
    res.status(400).json({ error: "Patch date, text, artwork, or gift is invalid, blank, or too long for patch mail." });
    return;
  }
  try {
    res.status(201).json(CreateAdminPatchResponse.parse(await createPatchDraft(input, userId)));
  } catch {
    res.status(409).json({ error: "Patch version is already in use or the draft could not be saved." });
  }
});

router.put("/admin/patches/:id", async (req, res): Promise<void> => {
  const userId = authorizeMutation(req, res);
  if (!userId) return;
  const params = UpdateAdminPatchParams.safeParse(req.params);
  const parsed = UpdateAdminPatchBody.strict().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid patch draft." });
    return;
  }
  const input = normalizedInput(parsed.data);
  if (!validTextContent(input)) {
    res.status(400).json({ error: "Patch date, text, artwork, or gift is invalid, blank, or too long for patch mail." });
    return;
  }
  try {
    const updated = await updatePatchDraft(params.data.id, input);
    if (updated) {
      res.json(UpdateAdminPatchResponse.parse(updated));
      return;
    }
    const existing = await getAdminPatch(params.data.id);
    res.status(existing ? 409 : 404).json({ error: existing ? "Published patches cannot be edited." : "Patch draft not found." });
  } catch {
    res.status(409).json({ error: "Patch version is already in use or the draft could not be saved." });
  }
});

router.get("/admin/patches/:id/preview", async (req, res): Promise<void> => {
  if (!adminId(req, res)) return;
  const params = PreviewAdminPatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid patch ID." });
    return;
  }
  try {
    const result = await previewPatch(params.data.id);
    if (!result) {
      res.status(404).json({ error: "Patch draft not found." });
      return;
    }
    res.json(PreviewAdminPatchResponse.parse(result));
  } catch {
    res.status(503).json({ error: "Patch preview is unavailable. Please retry." });
  }
});

router.post("/admin/patches/:id/publish", async (req, res): Promise<void> => {
  const userId = authorizeMutation(req, res);
  if (!userId) return;
  const params = PublishAdminPatchParams.safeParse(req.params);
  const parsed = PublishAdminPatchBody.strict().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid patch publication request." });
    return;
  }
  try {
    const result = await publishPatch(params.data.id, parsed.data.confirmVersion, userId);
    if (result.kind === "missing") {
      res.status(404).json({ error: "Patch draft not found." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "Patch changed since preview or was already published. Refresh before confirming." });
      return;
    }
    await processPatchDeliveryBatch(params.data.id);
    const updated = await getAdminPatch(params.data.id);
    res.json(PublishAdminPatchResponse.parse(updated));
  } catch {
    res.status(503).json({ error: "Patch publication could not be confirmed. Refresh before retrying." });
  }
});

router.post("/admin/patches/:id/deliver", async (req, res): Promise<void> => {
  if (!authorizeMutation(req, res)) return;
  const params = ResumeAdminPatchDeliveryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid patch ID." });
    return;
  }
  try {
    const patch = await getAdminPatch(params.data.id);
    if (!patch || patch.status !== "published") {
      res.status(404).json({ error: "Published patch not found." });
      return;
    }
    await processPatchDeliveryBatch(params.data.id, true);
    res.json(ResumeAdminPatchDeliveryResponse.parse(await getAdminPatch(params.data.id)));
  } catch {
    res.status(503).json({ error: "Patch delivery progress is unavailable. Please retry." });
  }
});

export default router;