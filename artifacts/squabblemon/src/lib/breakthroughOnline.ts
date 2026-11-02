import { ApiError, customFetch } from "@workspace/api-client-react";
import { BREAKTHROUGH_PROTOCOL } from "@workspace/squabblemon-engine/breakthroughOnline";
import type {
  BreakthroughRoomView,
  RoomCommandEnvelope,
  RoomIntent,
  RoomAck,
} from "@workspace/squabblemon-engine/breakthroughRoom";
import {
  applyRoomStream,
  type RoomStreamFrame,
} from "@workspace/squabblemon-engine/breakthroughRoomStream";
export function breakthroughRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return customFetch<T>(`/api/breakthrough${path}`, {
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "x-breakthrough-protocol": BREAKTHROUGH_PROTOCOL },
    credentials: "same-origin",
    cache: "no-store",
    responseType: "json",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
}
/** Account + room journal. Lost acknowledgements resend the original identity and sequence, never mint a new play. */
export class BreakthroughConnection {
  private controller = new AbortController();
  private view: BreakthroughRoomView | null = null;
  private pending: RoomCommandEnvelope | null = null;
  private writing = false;
  private nextSequence = 1;
  private key: string;
  constructor(
    readonly accountId: string,
    readonly roomId: string,
    private publish: (view: BreakthroughRoomView) => void,
    private status: (message: string) => void,
  ) {
    this.key = `breakthrough-command:${accountId}:${roomId}`;
    try {
      this.pending = JSON.parse(sessionStorage.getItem(this.key) ?? "null");
    } catch {
      this.pending = null;
    }
  }
  private async flush() {
    if (!this.pending || this.writing || this.controller.signal.aborted) return;
    this.writing = true;
    try {
      const ack = await breakthroughRequest<RoomAck>(
        `/${this.roomId}/commands`,
        this.pending,
        this.controller.signal,
      );
      if (this.controller.signal.aborted) return;
      this.nextSequence = Math.max(this.nextSequence, ack.nextSequence);
      this.pending = null;
      sessionStorage.removeItem(this.key);
      this.status(
        ack.accepted
          ? ""
          : (ack.message ?? "That play is no longer available."),
      );
    } catch (e) {
      if (this.controller.signal.aborted) return;
      // A definite client rejection cannot have committed. Network/5xx/429 retain the original envelope.
      if (
        e instanceof ApiError &&
        [400, 401, 403, 404, 409].includes(e.status)
      ) {
        this.pending = null;
        sessionStorage.removeItem(this.key);
      }
      this.status(
        e instanceof Error ? e.message : "Reconnecting to confirm your play…",
      );
    } finally {
      this.writing = false;
    }
  }
  async command(command: RoomIntent) {
    if (!this.view || this.pending || this.controller.signal.aborted) return;
    const envelope = {
      commandId: crypto.randomUUID(),
      sequence: Math.max(this.nextSequence, this.view.nextSequence),
      observedRevision: this.view.revision,
      command,
    };
    // Persist before sending. If storage is unavailable, refuse the play instead of making it unrecoverable.
    try {
      sessionStorage.setItem(this.key, JSON.stringify(envelope));
    } catch {
      this.status("Allow session storage to safely send this play.");
      return;
    }
    this.pending = envelope;
    this.status("Sending…");
    await this.flush();
  }
  async start() {
    let failures = 0;
    while (!this.controller.signal.aborted) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      const attempt = new AbortController();
      const timeout = setTimeout(() => attempt.abort(), 55000);
      try {
        const response = await customFetch<Response>(
          `/api/breakthrough/${this.roomId}/stream`,
          {
            headers: { "x-breakthrough-protocol": BREAKTHROUGH_PROTOCOL },
            credentials: "same-origin",
            cache: "no-store",
            responseType: "response",
            signal: AbortSignal.any([attempt.signal, this.controller.signal]),
          },
        );
        if (!response.body) throw Error("Arena stream unavailable.");
        reader = response.body.getReader();
        let buffer = "";
        const decoder = new TextDecoder();
        this.view = null;
        while (!this.controller.signal.aborted) {
          const chunk = await reader.read();
          if (this.controller.signal.aborted) return;
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 2_000_000) throw Error("Arena frame too large.");
          let split: number;
          while ((split = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            if (!raw.startsWith("data: ")) continue;
            const frame = JSON.parse(raw.slice(6)) as RoomStreamFrame;
            const next = applyRoomStream(this.view, frame);
            if (next.roomId !== this.roomId)
              throw Error("Arena identity changed.");
            this.view = next;
            this.nextSequence = Math.max(this.nextSequence, next.nextSequence);
            failures = 0;
            this.publish(next);
            if (!this.pending) this.status("");
            void this.flush();
            if (next.phase !== "active") return;
          }
        }
      } catch (e) {
        if (this.controller.signal.aborted) return;
        this.status("Reconnecting… Your match continues.");
        if (
          e instanceof ApiError &&
          [400, 401, 403, 404, 409].includes(e.status)
        ) {
          this.status(e.message);
          return;
        }
        failures++;
      } finally {
        clearTimeout(timeout);
        attempt.abort();
        await reader?.cancel().catch(() => undefined);
      }
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          this.controller.signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(
          finish,
          Math.min(5000, 200 * 2 ** Math.min(failures, 5)),
        );
        this.controller.signal.addEventListener("abort", finish, {
          once: true,
        });
        if (this.controller.signal.aborted) finish();
      });
    }
  }
  stop() {
    this.controller.abort();
  }
}
