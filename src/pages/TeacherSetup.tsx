import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DIM_ICON } from '../components/icons';
import { COMPETENCY_META } from '../data/blocks';
import { challengesIn, THEMES } from '../data/themes';
import { cleanSettings, MAX_CHALLENGES, QUESTIONS, TIME_OPTIONS, type AssessmentSettings, type Requirement } from '../engine/assessmentSettings';
import { CRITERION_NAME } from '../engine/marking';
import type { AssessmentLevel, Desk } from '../engine/mission';
import { supabase } from '../lib/supabase';
import { createClass, findClass, saveClassSettings } from '../lib/sync';
import { useTeacherSettings } from '../store/teacherSettings';

const field = 'rounded border-1.5 border-ink bg-paper-card px-3 py-2';

function Step({ n, title, children, hint }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-md border-1.5 border-ink bg-paper-card p-5 md:p-6 shadow-hard space-y-4" aria-labelledby={`setup-${n}`}>
    <div><p className="label text-ink-3">Step {n}</p><h2 id={`setup-${n}`} className="text-2xl font-extrabold mt-0.5">{title}</h2>{hint && <p className="text-ink-2 mt-1">{hint}</p>}</div>
    {children}
  </section>;
}

/** Choice buttons in the studio style (a radio group). */
function Choice<T extends string | number | null>({ value, options, change, label }: { value: T; options: [T, string][]; change: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded border-1.5 border-ink overflow-hidden">
    {options.map(([v, text]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => change(v)}
      className={`px-3 py-1.5 text-sm font-bold border-r-1.5 border-ink last:border-r-0 ${value === v ? 'bg-signal' : 'bg-paper-card hover:bg-paper'}`}>{text}</button>)}
  </div>;
}

/**
 * Teachers choose the assessment: which challenges, whether each written question is required or
 * optional, and whether the level and time are fixed. Saved on this device, and to a class when
 * the teacher gives the class's teacher code, so pupils who start with that class code get them.
 */
export default function TeacherSetup() {
  const { settings: saved, classCode: savedClass, save } = useTeacherSettings();
  const [s, setS] = useState<AssessmentSettings>(saved);
  const [classCode, setClassCode] = useState(savedClass ?? '');
  const [teacherCode, setTeacherCode] = useState('');
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = s.challenges ?? [];
  const random = s.challenges === null;

  const toggle = (id: Desk) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length < MAX_CHALLENGES ? [...chosen, id] : chosen;
    setS({ ...s, challenges: next });
  };
  const ready = random || chosen.length > 0;
  const final = (): AssessmentSettings => ({ ...s, challenges: random ? null : chosen });

  async function saveTo(where: 'device' | 'class' | 'new') {
    if (!ready) return;
    setStatus(null);
    if (where === 'device') { save(final()); setStatus({ ok: true, text: 'Saved on this device. Assessments started here without a class code use these settings.' }); return; }
    setBusy(true);
    try {
      if (where === 'new') {
        const made = await createClass(newName, teacherCode);
        if ('error' in made) { setStatus({ ok: false, text: made.error }); return; }
        const err = await saveClassSettings(made.code, teacherCode, final());
        if (err) { setStatus({ ok: false, text: err }); return; }
        save(final(), made.code); setClassCode(made.code);
        setStatus({ ok: true, text: `Class created. Give pupils the code ${made.code}. Keep your teacher code to change the settings later.` });
        return;
      }
      const err = await saveClassSettings(classCode, teacherCode, final());
      if (err) { setStatus({ ok: false, text: err }); return; }
      save(final(), classCode.trim().toUpperCase());
      setStatus({ ok: true, text: `Saved to class ${classCode.trim().toUpperCase()}. Pupils who start with this code get these settings.` });
    } finally { setBusy(false); }
  }

  async function load() {
    setStatus(null);
    const found = await findClass(classCode);
    if ('error' in found) { setStatus({ ok: false, text: found.error }); return; }
    setS(cleanSettings(found.settings));
    setStatus({ ok: true, text: found.settings ? `Loaded the settings of ${found.name}.` : `${found.name} has no settings yet: showing the defaults.` });
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-8 md:py-10 space-y-6" data-testid="teacher-setup">
      <header>
        <Link to="/teacher" className="inline-flex items-center gap-1 font-bold underline underline-offset-2"><ArrowLeft size={16} aria-hidden /> Teacher view</Link>
        <p className="label text-ink-2 mt-6">For teachers</p>
        <h1 className="text-5xl font-extrabold leading-[0.98] mt-2">Set up an <span className="bg-signal px-1.5 -mx-0.5 box-decoration-clone">assessment.</span></h1>
        <p className="mt-4 text-lg text-ink-2 max-w-2xl">Choose the challenges and which written answers pupils must give. Each attempt keeps the settings it started with.</p>
      </header>

      <Step n={1} title="Challenges" hint={`Pupils work on each one: build, test, attack, then a curveball. Choose up to ${MAX_CHALLENGES}.`}>
        <Choice label="How challenges are chosen" value={random ? 'random' : 'chosen'} change={(v) => setS({ ...s, challenges: v === 'random' ? null : chosen })}
          options={[['random', 'Random: one from each theme'], ['chosen', 'I choose']]} />
        {!random && <>
          <p className="font-bold" aria-live="polite">{chosen.length} of {MAX_CHALLENGES} chosen{chosen.length === 0 && ': choose at least one'}</p>
          <div className="space-y-5">{THEMES.map((t) => {
            const Icon = DIM_ICON[t.competency];
            return <fieldset key={t.id}>
              <legend className="font-extrabold flex items-center gap-2"><Icon size={18} aria-hidden style={{ color: COMPETENCY_META[t.competency].color }} /> {t.title}</legend>
              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{challengesIn(t.id).map((c) => {
                const on = chosen.includes(c.id as Desk);
                const full = !on && chosen.length >= MAX_CHALLENGES;
                return <label key={c.id} className={`flex gap-2 rounded border-1.5 p-3 cursor-pointer ${on ? 'border-ink bg-signal-soft' : 'border-line bg-paper-card'} ${full ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" className="mt-1" checked={on} disabled={full} onChange={() => toggle(c.id as Desk)} data-testid={`setup-${c.id}`} />
                  <span><b className="block leading-tight">{c.title}</b><span className="text-sm text-ink-2">{c.audience}</span></span>
                </label>;
              })}</div>
            </fieldset>;
          })}</div>
        </>}
      </Step>

      <Step n={2} title="Written answers" hint="Required answers must be written before pupils can continue. An optional answer that is left blank doesn't lower the final score.">
        <ul className="divide-y divide-line border-y border-line">{QUESTIONS.map((q) => (
          <li key={q.key} className="py-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div><b>{q.label}</b>{q.skill && <span className="ml-2 text-xs font-bold rounded-sm border border-line px-1.5 py-0.5">Marks {CRITERION_NAME[q.skill].toLowerCase()}</span>}
              <p className="text-sm text-ink-2">{q.when}</p></div>
            <Choice<Requirement> label={q.label} value={s.questions[q.key]} change={(v) => setS({ ...s, questions: { ...s.questions, [q.key]: v } })}
              options={[['required', 'Required'], ['optional', 'Optional']]} />
          </li>))}</ul>
      </Step>

      <Step n={3} title="Level and time">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><p className="font-bold mb-2">Level</p>
            <Choice<AssessmentLevel | null> label="Level" value={s.level} change={(level) => setS({ ...s, level })}
              options={[[null, 'Pupils choose'], [1, 'Level 1'], [2, 'Level 2 · IF blocks']]} /></div>
          <div><p className="font-bold mb-2">Time allowance</p>
            <Choice<number | null> label="Time allowance" value={s.minutes} change={(minutes) => setS({ ...s, minutes })}
              options={[[null, 'Pupils choose'], ...TIME_OPTIONS.map((n) => [n, n ? `${n} min` : 'Untimed'] as [number, string])]} /></div>
        </div>
      </Step>

      <Step n={4} title="Save" hint="Save to a class so pupils get these settings when they enter its code on the start page.">
        <div className="flex flex-wrap gap-3 items-center">
          <button className="btn bg-paper-card" disabled={!ready} onClick={() => saveTo('device')} data-testid="save-device">Save on this device</button>
        </div>
        {supabase ? <div className="grid md:grid-cols-2 gap-5">
          <form className="rounded border border-line p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); saveTo('class'); }}>
            <h3 className="font-bold">An existing class</h3>
            <label className="block text-sm font-bold">Class code<input className={`${field} block mt-1 w-full font-mono uppercase`} value={classCode} onChange={(e) => setClassCode(e.target.value)} required maxLength={12} /></label>
            <label className="block text-sm font-bold">Teacher code<input className={`${field} block mt-1 w-full`} type="password" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} required minLength={4} autoComplete="off" /></label>
            <div className="flex flex-wrap gap-2"><button className="btn bg-signal" disabled={busy || !ready}>Save to class</button>
              <button type="button" className="btn bg-paper-card" disabled={busy || !classCode.trim()} onClick={load}>Load its settings</button></div>
          </form>
          <form className="rounded border border-line p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); saveTo('new'); }}>
            <h3 className="font-bold">A new class</h3>
            <label className="block text-sm font-bold">Class name<input className={`${field} block mt-1 w-full`} value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={40} placeholder="e.g. 8B Computing" /></label>
            <label className="block text-sm font-bold">Choose a teacher code<input className={`${field} block mt-1 w-full`} type="password" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} required minLength={4} autoComplete="off" /></label>
            <button className="btn bg-signal" disabled={busy || !ready}>Create class and save</button>
          </form>
        </div> : <p className="text-sm text-ink-2">Classes need the online version. On this device, settings apply to assessments started without a class code.</p>}
        {status && <p role={status.ok ? 'status' : 'alert'} className={`flex items-start gap-2 font-bold ${status.ok ? 'text-pass' : 'text-fail'}`}>{status.ok && <Check size={18} aria-hidden className="mt-0.5" />}{status.text}</p>}
      </Step>
    </div>
  );
}
