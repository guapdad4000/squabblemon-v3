import type { SocialInvitation } from '@workspace/api-client-react';
import { basePath } from '../../lib/routing';

export const FRIEND_CODE_PATTERN = /^[A-F0-9]{12}$/;
export const normalizeCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase().slice(0, 12);

export function socialError(reason: unknown, fallback = 'That did not go through. Try again.') {
  if (reason && typeof reason === 'object') {
    const data = (reason as { data?: unknown }).data;
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') return (data as { error: string }).error;
    const message = (reason as { message?: unknown }).message;
    if (typeof message === 'string' && message && !/^HTTP \d+/.test(message)) return message;
  }
  return fallback;
}

export const friendLink = (code: string) => `${window.location.origin}${basePath}/game/settings?friend=${code}#homies`;

export const statusCopy: Record<SocialInvitation['status'], string> = {
  pending: 'Waiting on an answer',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Called off',
  expired: 'Expired',
  unavailable: 'No longer available',
  closed: 'Room closed',
};

export function expiresIn(iso: string, now = Date.now()) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes <= 0) return 'expiring now';
  if (minutes < 60) return `${minutes} min left`;
  return `${Math.round(minutes / 60)} hr left`;
}

export function sinceLabel(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}

/** navigator.share, then clipboard; returns false when the caller must show a selectable fallback. */
export async function shareOrCopy(text: string, title?: string): Promise<'shared' | 'copied' | false> {
  if (title && typeof navigator.share === 'function') {
    try { await navigator.share({ title, url: text }); return 'shared'; }
    catch (reason) { if ((reason as { name?: string })?.name === 'AbortError') return 'shared'; }
  }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return false; }
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
export const normalizeHandle = (value: string) => value.trim().replace(/^@/, '');

/** Truthful activity copy from recorded lastActiveAt; never claims live presence. */
export function presenceLabel(iso: string | null, now = Date.now()) {
  if (!iso) return { text: 'No recent activity', recent: false };
  const minutes = (now - new Date(iso).getTime()) / 60000;
  if (!Number.isFinite(minutes)) return { text: 'No recent activity', recent: false };
  if (minutes < 15) return { text: 'Recently active', recent: true };
  return { text: `Last seen ${sinceLabel(iso, now)}`, recent: false };
}
