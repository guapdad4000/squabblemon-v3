import { randomUUID } from 'node:crypto';
import type { pool } from '@workspace/db';
type Pool = typeof pool;
const connect = (pool: Pool) => pool.connect();
type Client = Awaited<ReturnType<typeof connect>>;
const MAX_BYTES = 2 * 1024 * 1024;
/** Database notifications are transient transport, never the journal or a command acknowledgement.
 * Each request/stream owns a session and releases it on close. A transaction-mode pooler
 * is incompatible: the hosted readiness probe must prove LISTEN/NOTIFY before admission. */
export class BreakthroughBus {
  private parts = new Map<string, { chunks: string[]; count: number; bytes: number; at: number }>();
  private closed = false;
  private constructor(private client: Client, readonly channel: string) {}
  static async open(pool: Pool, channel: string, receive: (value: any) => void, failed: (error: Error) => void) {
    if (!/^bt_[a-z0-9_]{1,59}$/.test(channel)) throw Error('Invalid room channel');
    const client = await pool.connect(), bus = new BreakthroughBus(client, channel);
    client.on('error', failed);
    client.on('notification', notification => {
      if (notification.channel !== channel || bus.closed) return;
      try {
        const part = JSON.parse(notification.payload ?? '');
        if (typeof part.id !== 'string' || !Number.isInteger(part.n) || part.n < 1 || part.n > 512 ||
          !Number.isInteger(part.i) || part.i < 0 || part.i >= part.n || typeof part.data !== 'string') return;
        const now = Date.now();
        for (const [id, entry] of bus.parts) if (now - entry.at > 5000) bus.parts.delete(id);
        if (!bus.parts.has(part.id)) {
          if (bus.parts.size >= 8) throw Error('Room transport backlog');
          bus.parts.set(part.id, { chunks: [], count: part.n, bytes: 0, at: now });
        }
        const entry = bus.parts.get(part.id)!;
        if (entry.count !== part.n) throw Error('Invalid room frame');
        if (entry.chunks[part.i] === undefined) { entry.bytes += part.data.length; entry.chunks[part.i] = part.data; }
        if (entry.bytes > MAX_BYTES * 1.4) throw Error('Room frame too large');
        if (entry.chunks.filter(v => v !== undefined).length === entry.count) {
          bus.parts.delete(part.id);
          receive(JSON.parse(Buffer.from(entry.chunks.join(''), 'base64').toString('utf8')));
        }
      } catch (error) { failed(error instanceof Error ? error : Error('Invalid room frame')); }
    });
    try { await client.query(`LISTEN ${channel}`); return bus; }
    catch (error) { await bus.close(); throw error; }
  }
  async send(channel: string, value: unknown) { return BreakthroughBus.send(this.client, channel, value); }
  static async send(client: Pick<Client, 'query'> | Pool, channel: string, value: unknown) {
    if (!/^bt_[a-z0-9_]{1,59}$/.test(channel)) throw Error('Invalid room channel');
    const bytes = Buffer.from(JSON.stringify(value));
    if (bytes.length > MAX_BYTES) throw Error('Room frame too large');
    const data = bytes.toString('base64'), id = randomUUID(), n = Math.ceil(data.length / 6000);
    const chunks = Array.from({length: n}, (_, i) => JSON.stringify({id, i, n, data: data.slice(i * 6000, (i + 1) * 6000)}));
    // Each notification remains below PostgreSQL's 8000-byte limit; one query publishes the frame atomically.
    await client.query('SELECT pg_notify($1, value) FROM jsonb_array_elements_text($2::jsonb)', [channel, JSON.stringify(chunks)]);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.parts.clear();
    this.client.removeAllListeners('notification');
    this.client.removeAllListeners('error');
    this.client.release(true); // Never return a LISTEN session to the general query pool.
  }
}
export const roomChannel = (roomId: string) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(roomId)) throw Error('Invalid room ID');
  return 'bt_room_' + roomId.replaceAll('-', '').toLowerCase();
};
export const replyChannel = () => 'bt_reply_' + randomUUID().replaceAll('-', '');
