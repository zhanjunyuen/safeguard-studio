import { useState } from 'react';
import { joinClass } from '../lib/sync';
import { supabase } from '../lib/supabase';
import { useSession } from '../store/session';

/** Class code + first name. Hidden entirely when the site has no backend configured. */
export default function JoinClass() {
  const { classCode, className, studentName, joined, leaveClass } = useSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!supabase) return null;

  if (classCode) {
    return (
      <p className="mt-6 text-ink-2" data-testid="joined">
        You're in <b className="text-ink">{className}</b> as <b className="text-ink">{studentName}</b>. Your runs are shared with your teacher.{' '}
        <button onClick={leaveClass} className="underline underline-offset-2 font-bold">Not you?</button>
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await joinClass(code.trim().toUpperCase(), name.trim());
    setBusy(false);
    if ('error' in res) setError(res.error);
    else joined(code.trim().toUpperCase(), res.className, res.id, name.trim());
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-2" aria-label="Join your class">
      <label className="text-sm font-bold">
        Class code
        <input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={12} className="block mt-1 w-32 rounded border-1.5 border-ink bg-paper-card px-3 py-2 font-mono uppercase" />
      </label>
      <label className="text-sm font-bold">
        First name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} className="block mt-1 w-40 rounded border-1.5 border-ink bg-paper-card px-3 py-2" />
      </label>
      <button disabled={busy} className="btn bg-paper-card">{busy ? 'Joining…' : 'Join your class'}</button>
      {error && <p className="w-full text-fail font-bold text-sm" role="alert">{error}</p>}
      <p className="w-full text-xs text-ink-3">Only your first name and class code are saved. No email or password.</p>
    </form>
  );
}
