import { literacyAiUrl, supabaseKey } from './supabase';

/** Longest the browser waits for the AI (ms) before using the offline marker instead. */
export const AI_TIMEOUT_MS = 45_000;

/**
 * Posts one task to the literacy-ai Edge Function and returns the model's raw reply text,
 * or null on any failure (not configured, offline, timed out, rate limited, bad reply).
 * Callers always have an offline fallback, so a null never breaks the page.
 */
export async function askLiteracyAi(body: Record<string, unknown>, signal?: AbortSignal): Promise<string | null> {
  if (!literacyAiUrl) return null;
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(stop, AI_TIMEOUT_MS);
  try {
    const res = await fetch(literacyAiUrl, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.text === 'string' && data.text.trim() ? data.text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}
