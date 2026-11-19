// Edge Function `literacy-ai`: the only place the app talks to the Adaption AI.
//
// The browser posts { task, ...data } with task = mark | followup | summary | hint.
// This function builds the prompt (prompts.js), calls the Adaption stack with the key held
// as a function secret, and returns { text } (the model's raw reply). The browser then checks
// the reply with the same rules as the offline marker (parseModelMark: exact quotes, simulator
// facts, levelFor), and falls back to the offline marker on any error.
//
// Secrets (never in the repo or the browser):  npx supabase secrets set ADAPTION_API_KEY=...
// Deploy:                                       npx supabase functions deploy literacy-ai --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { buildTask } from './prompts.js';

/** Adaption's Responses API and the stack that serves the literacy model. */
const ADAPTION_URL = 'https://api.prod.adaptionlabs.ai/api/v1/responses';
const ADAPTION_MODEL = Deno.env.get('ADAPTION_MODEL') ?? 'stack:adaption-backend-for-literacy';

/** Room for the reply in tokens: the marker writes its reasoning before the JSON. */
const MAX_OUTPUT_TOKENS = 3000;
/** Give up on the model after this long; the browser then uses the offline marker. */
const TIMEOUT_MS = 40_000;
/** Most AI calls per hour across everyone, so a public site cannot run up the Adaption bill. */
const MAX_AI_CALLS_PER_HOUR = 1500;

/** Sites allowed to call the function. */
const ALLOWED_ORIGINS = ['https://zhanjunyuen.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
const reply = (body, status, origin) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

/** The text of a Responses API reply (output_text, or the output_text parts joined). */
function replyText(data) {
  return data?.output_text ?? (data?.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('');
}

/** True if some top-level {...} block in the text parses and has `key` (the model may wrap
 *  its JSON in a code fence or words). Brace counting ignores braces inside strings, which is
 *  fine here: a block that fails to parse is just skipped. */
function hasJsonKey(text, key) {
  const clean = String(text).replace(/```(?:json)?/gi, '');
  let depth = 0, start = -1;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (clean[i] === '}' && depth > 0 && --depth === 0) {
      try { const o = JSON.parse(clean.slice(start, i + 1)); if (o && typeof o === 'object' && key in o) return true; } catch { /* not this block */ }
    }
  }
  return false;
}

/** Logs one call and returns false when the hourly budget is used up (or can't be checked). */
async function budgetLeft(task) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return false;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await admin.from('ai_calls').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo);
  if (error || (count ?? 0) >= MAX_AI_CALLS_PER_HOUR) return false;
  await admin.from('ai_calls').insert({ task });
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405, origin);

  let task;
  try {
    task = buildTask(await req.json());
  } catch (e) {
    return reply({ error: `bad request: ${e.message}` }, 400, origin);
  }
  const key = Deno.env.get('ADAPTION_API_KEY');
  if (!key) return reply({ error: 'AI not configured' }, 503, origin);
  if (!(await budgetLeft(task.expect ?? 'followup'))) return reply({ error: 'AI busy, try later' }, 429, origin);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ADAPTION_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ADAPTION_MODEL,
        ...(task.instructions ? { instructions: task.instructions } : {}),
        input: task.input,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return reply({ error: `AI error ${res.status}` }, 502, origin);
    const text = replyText(await res.json());
    if (!text?.trim()) return reply({ error: 'empty AI reply' }, 502, origin);
    if (task.expect && !hasJsonKey(text, task.expect)) return reply({ error: 'AI reply not in the expected format' }, 502, origin);
    return reply({ text, model: ADAPTION_MODEL }, 200, origin);
  } catch {
    return reply({ error: 'AI timed out' }, 504, origin);
  } finally {
    clearTimeout(timer);
  }
});
