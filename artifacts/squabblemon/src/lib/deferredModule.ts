export type DeferredModule<T> = {
  peek: () => T | undefined;
  load: () => Promise<T>;
};

// A rejected import can retry. A successful import stays available across closes
// and route returns without downloading or evaluating the feature again.
export function createDeferredModule<T>(importModule: () => Promise<T>, retryModule?: (failure: unknown) => Promise<T>): DeferredModule<T> {
  let value: T | undefined;
  let loaded = false;
  let pending: Promise<T> | undefined;
  let failed = false;
  let failure: unknown;
  return {
    peek: () => loaded ? value : undefined,
    load() {
      if (loaded) return Promise.resolve(value as T);
      if (!pending) {
        pending = Promise.resolve().then(() => failed && retryModule ? retryModule(failure) : importModule()).then(result => {
          value = result;
          loaded = true;
          failed = false;
          pending = undefined;
          return result;
        }, error => {
          pending = undefined;
          failed = true;
          failure = error;
          throw error;
        });
      }
      return pending;
    },
  };
}
