import type { Express } from 'express';
import serverless from 'serverless-http';

type LambdaResponse = { statusCode: number; headers?: Record<string, string>; cookies?: string[]; body?: string; isBase64Encoded?: boolean };

/** Preserve Express routing, bodies, and auth cookies behind a Web Request function. */
export function webRequestAdapter(app: Express) {
  const handle = serverless(app, { binary: true });
  return async (request: Request, sourceIp = '127.0.0.1') => {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers);
    headers.host = url.host;
    headers['x-forwarded-host'] = url.host;
    headers['x-forwarded-proto'] = url.protocol.slice(0, -1);
    const body = ['GET', 'HEAD'].includes(request.method) ? '' : Buffer.from(await request.arrayBuffer()).toString('base64');
    const result = await handle({ version: '2.0', routeKey: '$default', rawPath: url.pathname, rawQueryString: url.search.slice(1), headers,
      requestContext: { http: { method: request.method, path: url.pathname, sourceIp, protocol: 'HTTP/1.1' }, domainName: url.hostname },
      body, isBase64Encoded: true,
    }, {}) as LambdaResponse;
    const responseHeaders = new Headers(result.headers);
    responseHeaders.delete('transfer-encoding');
    for (const cookie of result.cookies ?? []) responseHeaders.append('set-cookie', cookie);
    const responseBody = result.isBase64Encoded ? new Uint8Array(Buffer.from(result.body ?? '', 'base64')) : result.body ?? '';
    return new Response(request.method === 'HEAD' || [204, 205, 304].includes(result.statusCode) ? null : responseBody, { status: result.statusCode, headers: responseHeaders });
  };
}
