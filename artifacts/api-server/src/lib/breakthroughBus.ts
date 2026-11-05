import { randomUUID } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { pool } from '@workspace/db';
type Pool = typeof pool;
const connect = (pool: Pool) => pool.connect();
type Client = Awaited<ReturnType<typeof connect>>;
const MAX_BYTES = 2 * 1024 * 1024;
const sessionPools = new WeakMap<Pool, Pool>();
/** Neon transaction pooling cannot retain LISTEN state. Keep ordinary queries pooled,
 * but use the same branch/role's documented direct endpoint for notification sessions. */
function notificationPool(pool: Pool): Pool {
  const connectionString = pool.options.connectionString;
  if (!connectionString) return pool;
  const url = new URL(connectionString);
  if (!url.hostname.endsWith('.neon.tech') || !url.hostname.includes('-pooler.')) return pool;
  let direct = sessionPools.get(pool);
  if (!direct) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    const SessionPool = pool.constructor as new (options: typeof pool.options) => Pool;
    direct = new SessionPool({...pool.options, connectionString: url.toString(), max: 5, allowExitOnIdle: true});
    sessionPools.set(pool, direct);
  }
  return direct;
}
export interface BreakthroughTransport {
  send(channel: string, value: unknown): Promise<void>;
  close(): Promise<void>;
}
export const usesBreakthroughMailbox = () => process.env.BREAKTHROUGH_TRANSPORT === 'mailbox' || typeof Netlify !== 'undefined';
function validateChannel(channel: string) {
  if (!/^bt_[a-z0-9_]{1,59}$/.test(channel)) throw Error('Invalid room channel');
}
/** Netlify's database proxy does not currently deliver our asynchronous notification
 * probe. A compressed, short-lived mailbox works through ordinary transactional SQL.
 * It is transport only: deleting a message never acknowledges a game command. */
class BreakthroughMailbox implements BreakthroughTransport {
  private closed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private running: Promise<void> = Promise.resolve();
  constructor(private pool: Pool, readonly channel: string, private receive: (value: any) => void, private failed: (error: Error) => void) {}
  start() {
    const run = () => {
      this.running = this.poll().catch(error => { if (!this.closed) this.failed(error); }).finally(() => {
        if (!this.closed) this.timer = setTimeout(run, this.channel.startsWith('bt_room_') ? 100 : 200);
      });
    };
    run();
  }
  private async poll() {
    const result = await this.pool.query(`WITH batch AS (
      SELECT id FROM breakthrough_transport WHERE channel=$1 AND expires_at>clock_timestamp()
      ORDER BY id LIMIT 64 FOR UPDATE SKIP LOCKED
    ) DELETE FROM breakthrough_transport AS message USING batch WHERE message.id=batch.id RETURNING message.id,message.payload`, [this.channel]);
    for (const row of result.rows.sort((a,b) => BigInt(a.id)<BigInt(b.id)?-1:1)) {
      if (this.closed) return;
      const raw = inflateRawSync(Buffer.from(row.payload,'base64'), {maxOutputLength: MAX_BYTES});
      this.receive(JSON.parse(raw.toString('utf8')));
    }
  }
  async send(channel: string, value: unknown) { return BreakthroughMailbox.send(this.pool,channel,value); }
  static async send(pool: Pick<Client,'query'> | Pool, channel: string, value: unknown) {
    validateChannel(channel);
    const raw=Buffer.from(JSON.stringify(value));
    if(raw.length>MAX_BYTES)throw Error('Room frame too large');
    const payload=deflateRawSync(raw,{level:1}).toString('base64');
    await pool.query("INSERT INTO breakthrough_transport(channel,payload,expires_at) VALUES($1,$2,clock_timestamp()+interval '30 seconds')",[channel,payload]);
  }
  async close() {
    if(this.closed)return; this.closed=true;clearTimeout(this.timer);await this.running;
    await this.pool.query('DELETE FROM breakthrough_transport WHERE channel=$1',[this.channel]);
  }
}
/** Database notifications are transient transport, never the journal or a command acknowledgement.
 * Each request/stream owns a session and releases it on close. A transaction-mode pooler
 * is incompatible: the hosted readiness probe must prove LISTEN/NOTIFY before admission. */
export class BreakthroughBus {
  private parts = new Map<string, { chunks: string[]; count: number; bytes: number; at: number }>();
  private closed = false;
  private constructor(private client: Client, readonly channel: string) {}
  static async open(pool: Pool, channel: string, receive: (value: any) => void, failed: (error: Error) => void): Promise<BreakthroughTransport> {
    validateChannel(channel);
    if (usesBreakthroughMailbox()) {
      const mailbox = new BreakthroughMailbox(pool,channel,receive,failed);
      mailbox.start(); return mailbox;
    }
    if (!/^bt_[a-z0-9_]{1,59}$/.test(channel)) throw Error('Invalid room channel');
    const client = await notificationPool(pool).connect(), bus = new BreakthroughBus(client, channel);
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
    if (usesBreakthroughMailbox()) return BreakthroughMailbox.send(client,channel,value);
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
