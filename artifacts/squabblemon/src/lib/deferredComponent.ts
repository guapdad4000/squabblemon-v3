import { createDeferredModule } from './deferredModule';

let retryId = 0;
export function optionalImportRetryUrl(error: unknown, feature: string, origin: string) {
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/https?:\/\/[^\s"'<>]+/);
  if (!match) return undefined;
  try {
    const url = new URL(match[0]);
    const filename = url.pathname.split('/').at(-1) ?? '';
    // Recover only this feature's failed entry, never an arbitrary dependency.
    const featureEntry = filename === `${feature}.tsx` || filename === `${feature}.ts`
      || (filename.startsWith(`${feature}-`) && filename.endsWith('.js'));
    if (url.origin !== origin || !featureEntry) return undefined;
    url.searchParams.set('popupRetry', `${Date.now()}-${++retryId}`);
    return url.href;
  } catch { return undefined; }
}

export function createDeferredComponent<M, K extends keyof M & string>(feature: string, exportName: K, importFeature: () => Promise<M>) {
  const select = (module: M) => {
    const component = module[exportName];
    if (typeof component !== 'function') throw new Error(`Could not open ${feature}. Try again.`);
    return component;
  };
  // Pass the full namespace through this loader. Its original export names
  // must survive production bundling for a direct URL retry to select them.
  return createDeferredModule(() => importFeature().then(select), async failure => {
    const url = typeof location !== 'undefined' ? optionalImportRetryUrl(failure, feature, location.origin) : undefined;
    if (!url) return importFeature().then(select);
    // Failed import URLs can be cached by the browser. A retry of the same
    // feature entry uses a fresh query while leaving the active page intact.
    return select(await import(/* @vite-ignore */ url) as M);
  });
}
