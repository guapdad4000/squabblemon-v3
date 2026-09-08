/** Isolated preview: preserve Battle's call surface without emitting analytics. */
export const trackEvent = (_name: string, _payload: Record<string, unknown>) => undefined;
export const decisionTimeBucket = (startedAt: number) => `${Math.max(0, Date.now() - startedAt)}ms`;