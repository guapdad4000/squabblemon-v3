import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 55439, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log('Isolated gameplay test database ready on localhost:55439');
async function stop() { await server.stop(); await db.close(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
