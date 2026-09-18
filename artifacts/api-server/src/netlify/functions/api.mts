import type { Config, Context } from '@netlify/functions';
import { webRequestAdapter } from '../../lib/webRequestAdapter';

async function getHandler() {
  const { default: app } = await import('../../app');
  return webRequestAdapter(app);
}
let handler: ReturnType<typeof getHandler> | undefined;

export default async function api(request: Request, context: Context) {
  if (!['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'].every(key => Netlify.env.get(key))) {
    return Response.json({ error: 'Account services are awaiting deployment configuration.' }, { status: 503 });
  }
  // The existing Node libraries read the same environment provided to the function.
  handler ??= getHandler().catch(error => { handler = undefined; throw error; });
  return (await handler)(request, context.ip);
}
export const config: Config = { path: ['/api', '/api/*'] };
