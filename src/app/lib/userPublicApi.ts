/** Public (unauthenticated) API — branch catalog, slots, online bookings. */

import { API_BASE } from './apiBase';

export function getPublicApiBase(): string {
  return API_BASE;
}

export async function fetchPublicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const withJsonType = method !== 'GET' && method !== 'HEAD';
  const baseHeaders = (init?.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = withJsonType
    ? { 'Content-Type': 'application/json', ...baseHeaders }
    : { ...baseHeaders };

  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return (await res.json()) as T;
}
