import { getAuth } from "@clerk/express";
import { Router, type Request, type Response } from "express";
import {
  BreakthroughRoomError,
  type BreakthroughRoomView,
} from "@workspace/squabblemon-engine/breakthroughRoom";
import { encodeRoomStream } from "@workspace/squabblemon-engine/breakthroughRoomStream";
import { BREAKTHROUGH_PROTOCOL } from "@workspace/squabblemon-engine/breakthroughOnline";
import { OnlineError } from "@workspace/squabblemon-engine/multiplayer";
import type { BreakthroughOnlineService } from "../lib/breakthroughOnline";
export type BreakthroughPrincipal = { userId: string; expiresAt: number };
function clerkPrincipal(req: Request): BreakthroughPrincipal | null {
  const auth = getAuth(req),
    exp = auth.sessionClaims?.exp;
  return auth.userId && typeof exp === "number"
    ? { userId: auth.userId, expiresAt: exp * 1000 }
    : null;
}
/** Reuses the app's Clerk, origin and JSON middleware. An injected principal exists only for owned tests. */
export function breakthroughRouter(
  service: BreakthroughOnlineService,
  principal = clerkPrincipal,
) {
  const router = Router(),
    streams = new Map<string, Set<() => void>>(),
    rates = new Map<string, { at: number; count: number }>();
  function error(req: Request, res: Response, e: unknown) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (e instanceof OnlineError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (e instanceof BreakthroughRoomError) {
      const status =
        e.code === "unauthorized"
          ? 403
          : e.code === "room-not-found"
            ? 404
            : e.code === "mode-unavailable" || e.code === "stale-owner"
              ? 503
              : e.code.includes("conflict") || e.code === "sequence-gap"
                ? 409
                : 400;
      res.status(status).json({
        error: e.message,
        code: e.code,
        expectedSequence: e.expectedSequence,
      });
      return;
    }
    req.log?.error({ err: e }, "Breakthrough request failed");
    res
      .status(503)
      .json({ error: "Arena connection interrupted. Reconnect to recover." });
  }
  router.use("/breakthrough", (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.header("x-breakthrough-protocol") !== BREAKTHROUGH_PROTOCOL) {
      res
        .status(409)
        .json({ error: "Refresh to use the latest Breakthrough client." });
      return;
    }
    const who = principal(req);
    if (!who || who.expiresAt <= Date.now()) {
      res.status(401).json({ error: "Sign in to play online." });
      return;
    }
    res.locals.breakthroughPrincipal = who;
    // Bound traffic and retained limiter state; reads and command bursts share an account budget.
    const now = Date.now();
    for (const [id, rate] of rates) if (now - rate.at > 10000) rates.delete(id);
    let rate = rates.get(who.userId);
    if (!rate || now - rate.at >= 1000) {
      rate = { at: now, count: 0 };
      rates.set(who.userId, rate);
    }
    if (++rate.count > 16) {
      res.status(429).json({ error: "Too many requests. Retry shortly." });
      return;
    }
    next();
  });
  const body = (req: Request, keys: string[]) => {
    const b = req.body;
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).some((k) => !keys.includes(k)) ||
      JSON.stringify(b).length > 8192
    )
      throw new BreakthroughRoomError("invalid-request", "Invalid request.");
    return b as Record<string, unknown>;
  };
  const endpoint =
    (fn: (req: Request, user: string) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        res.json(await fn(req, res.locals.breakthroughPrincipal.userId));
      } catch (e) {
        error(req, res, e);
      }
    };
  const room = (req: Request) => String(req.params.roomId);
  router.get(
    "/breakthrough",
    endpoint((_req, user) => service.lobby(user)),
  );
  router.post(
    "/breakthrough/search",
    endpoint((req, user) => {
      const b = body(req, ["deckId", "requestId"]);
      if (typeof b.deckId !== "string" || typeof b.requestId !== "string")
        throw new BreakthroughRoomError(
          "invalid-request",
          "Choose a saved deck.",
        );
      return service.searchMatch(user, b.deckId, b.requestId);
    }),
  );
  router.post(
    "/breakthrough/cancel",
    endpoint((req, user) => {
      const b = body(req, ["requestId"]);
      if (typeof b.requestId !== "string")
        throw new BreakthroughRoomError(
          "invalid-request",
          "Invalid search ID.",
        );
      return service.cancel(user, b.requestId);
    }),
  );
  router.get(
    "/breakthrough/:roomId",
    endpoint((req, user) => service.view(room(req), user)),
  );
  router.get(
    "/breakthrough/:roomId/receipt",
    endpoint((req, user) => service.receipt(room(req), user)),
  );
  router.post(
    "/breakthrough/:roomId/commands",
    endpoint((req, user) =>
      service.command(
        room(req),
        user,
        body(req, ["commandId", "sequence", "command", "observedRevision"]),
      ),
    ),
  );
  router.get("/breakthrough/:roomId/stream", async (req, res) => {
    const who = res.locals.breakthroughPrincipal as BreakthroughPrincipal;
    let last: BreakthroughRoomView | null = null,
      closed = false,
      busy = false,
      blocked = false,
      unsubscribe = () => {},
      timer: ReturnType<typeof setTimeout> | undefined,
      expiry: ReturnType<typeof setTimeout> | undefined,
      drainDeadline: ReturnType<typeof setTimeout> | undefined;
    let onDrain = () => {};
    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      clearTimeout(expiry);
      clearTimeout(drainDeadline);
      res.removeListener("drain", onDrain);
      unsubscribe();
      res.end();
      const set = streams.get(who.userId);
      set?.delete(close);
      if (!set?.size) streams.delete(who.userId);
    };
    try {
      const initial = await service.view(room(req), who.userId);
      if (res.destroyed) return;
      const connections = streams.get(who.userId) ?? new Set<() => void>();
      if (connections.size >= 2) {
        res
          .status(429)
          .json({ error: "Close another arena tab before connecting." });
        return;
      }
      connections.add(close);
      streams.set(who.userId, connections);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.on("close", close);
      // Bound authentication lifetime. Reconnect obtains a fresh Clerk token; tokens never enter URLs.
      expiry = setTimeout(
        close,
        Math.max(1, Math.min(45000, who.expiresAt - Date.now() - 1000)),
      );
      const send = (view: BreakthroughRoomView) => {
        if (closed) return;
        const frame = encodeRoomStream(last, view);
        // false means accepted into Node's buffer, not failed. Wait for drain and coalesce
        // subsequent ticks; immediately closing would loop forever on large snapshots.
        const ready = res.write(`data: ${JSON.stringify(frame)}\n\n`);
        last = view;
        if (view.phase !== "active") {
          close();
          return;
        }
        if (!ready) {
          blocked = true;
          drainDeadline = setTimeout(close, 10000);
        }
      };
      const update = () => {
        if (closed || busy || blocked || timer) return;
        timer = setTimeout(async () => {
          timer = undefined;
          if (closed) return;
          busy = true;
          try {
            const view = await service.view(room(req), who.userId);
            if (!last || view.revision !== last.revision) send(view);
          } catch (e) {
            req.log?.warn({ err: e }, "Arena stream reconnect");
            close();
          } finally {
            busy = false;
          }
        }, 100);
      };
      onDrain = () => {
        blocked = false;
        clearTimeout(drainDeadline);
        update();
      };
      res.on("drain", onDrain);
      unsubscribe = service.subscribe(room(req), update);
      send(initial);
    } catch (e) {
      error(req, res, e);
      close();
    }
  });
  return router;
}
