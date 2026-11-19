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

/** The literacy-ai Edge Function (the Adaption AI marker, follow-ups, hints and summary), or null
 *  when Supabase is not configured. Set VITE_LITERACY_AI=off to keep the offline markers. */
export const literacyAiUrl: string | null =
  url && key && import.meta.env.VITE_LITERACY_AI !== 'off' ? `${url}/functions/v1/literacy-ai` : null;
export const supabaseKey = key ?? '';
