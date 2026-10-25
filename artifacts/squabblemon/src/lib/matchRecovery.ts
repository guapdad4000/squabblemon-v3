import { ApiError } from '@workspace/api-client-react';

/** Only a server-issued compatibility response permits abandoning a saved transcript. */
export function isMatchRulesUpdated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 &&
    typeof error.data === 'object' && error.data !== null &&
    'code' in error.data && error.data.code === 'rules-updated';
}
