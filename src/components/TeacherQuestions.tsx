import { useEffect, useRef, useState } from 'react';
import { askLiteracyAi } from '../lib/literacyAi';
import { jsonIn } from '../engine/marking';
import { dashboardObservation, teacherEvidence, type PerformanceRow } from '../engine/teacherInsights';

interface Props {
  rows: (PerformanceRow & { id: string; name: string })[];
  pupil: string | null;
  select: (id: string | null) => void;
  scope: string;
  sample: boolean;
}

export default function TeacherQuestions({ rows, pupil, select, scope, sample }: Props) {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<{ question: string; text: string; ai: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function ask(input: string) {
    const q = input.trim();
    const group = pupil ? rows.filter(r => r.id === pupil) : rows;
    if (!q || !group.length || request.current) return;
    const evidence = teacherEvidence(group, scope, !!pupil, sample);
    const ctrl = new AbortController();
    request.current = ctrl;
    setBusy(true);
    setQuestion(q);
    setReply(null);
    const raw = await askLiteracyAi({ task: 'teacher', question: q, evidence }, ctrl.signal);
    if (ctrl.signal.aborted) return;
    const answer = raw && jsonIn(raw)?.answer;
    const ai = typeof answer === 'string' && !!answer.trim() && answer.length <= 2400;
    setReply({ question: q, text: ai ? answer.trim() : dashboardObservation(evidence, q), ai });
    request.current = null;
    setBusy(false);
  }

  return <section className="mt-6 rounded-md border-1.5 border-ink bg-paper-card p-5 space-y-3" aria-labelledby="teacher-questions">
    <h2 id="teacher-questions" className="text-2xl font-extrabold">Ask about pupil performance</h2>
    <div className="flex flex-wrap items-baseline gap-3">
      <label className="font-bold">About <select className="rounded border border-ink px-2 py-1" value={pupil ?? ''} onChange={e => select(e.target.value || null)}>
        <option value="">Whole class</option>{rows.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></label>
      <span className="text-sm text-ink-2">{sample ? 'Sample dashboard' : 'Live class'} · {scope}</span>
    </div>
    {rows.length ? <>
      <form onSubmit={e => { e.preventDefault(); void ask(question); }} className="space-y-2">
        <label htmlFor="teacher-question" className="block font-bold">Your question</label>
        <textarea id="teacher-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={300} rows={2}
          placeholder="What should I emphasise in the next lesson?" className="w-full rounded border border-ink p-2" />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn bg-signal" disabled={busy || !question.trim()}>{busy ? 'Reading results…' : 'Ask AI'}</button>
          {['What should I teach next?', 'Where has performance improved?'].map(q =>
            <button key={q} type="button" disabled={busy} className="text-sm underline" onClick={() => void ask(q)}>{q}</button>)}
        </div>
      </form>
      <div aria-live="polite" aria-busy={busy}>{reply && <div className="space-y-2 border-t border-line pt-3">
        <p className="font-bold">{reply.question}</p>
        <p className="label text-ink-2">{reply.ai ? 'AI answer' : 'AI unavailable · dashboard observations'}</p>
        <p className="whitespace-pre-line">{reply.text}</p>
      </div>}</div>
    </> : <p className="text-ink-2">Questions become available when this view has a recorded run.</p>}
  </section>;
}
