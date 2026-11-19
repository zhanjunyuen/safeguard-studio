import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Accept the project URL in any common shape (trailing slash, or copied from the
// Data API page with /rest/v1 on the end). supabase-js adds /rest/v1 itself.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|auth|storage)\/v1$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** null when the app is built without Supabase keys: everything then stays local, as before. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

/**
 * The literacy-ai Edge Function (the Adaption AI marker, follow-ups, hints, summary and verdict).
 * It can run in a separate Supabase project from the classes: set VITE_LITERACY_AI_URL and
 * VITE_LITERACY_AI_KEY (that project's URL and publishable key, both public by design). Otherwise it
 * uses the class project. Null when neither is set; VITE_LITERACY_AI=off keeps the offline markers.
 */
const aiBase = (import.meta.env.VITE_LITERACY_AI_URL as string | undefined)?.trim().replace(/\/+$/, '') || url;
const aiKey = (import.meta.env.VITE_LITERACY_AI_KEY as string | undefined)?.trim() || key;
export const literacyAiUrl: string | null =
  aiBase && aiKey && import.meta.env.VITE_LITERACY_AI !== 'off' ? `${aiBase}/functions/v1/literacy-ai` : null;
export const supabaseKey = aiKey ?? '';
