import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { askLiteracyAi } from '../lib/literacyAi';
import { offlinePupilFeedback, parsePupilAnswer, practiceSuggestion, pupilRuns, replayCases, resultQuestions, runFacts, type PupilRun } from '../engine/pupilResults';
import type { FinalScore } from '../engine/finalScore';
import { usePracticeStore, useAssessmentSession } from '../store/session';
import { useMission } from '../store/mission';
import { usePresenter } from '../store/presenter';

type Reply = { text: string; sources: string[]; practice?: { id: string; title: string }; unavailable?: boolean };

function Replay({ run }: { run: PupilRun }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [run.id]);
  return <section className="mt-4 border-t border-line pt-4" aria-label="Saved run replay">
    <h3 ref={title} tabIndex={-1} className="font-extrabold">{run.group} · {run.label}</h3>
    {run.prediction && <p className="my-2"><b>Your prediction</b> · {run.prediction}</p>}
    {replayCases(run).map(c => <details key={c.replay.id} className="mt-2 rounded border border-line p-2">
      <summary className="cursor-pointer font-bold">{c.title} · {c.outcome}</summary>
      {c.matches && <><p className="my-2">{c.replay.result.question}</p>
        <blockquote className="border-l-4 border-line pl-3">{c.replay.result.reply}</blockquote>
        <p className="my-2">{c.replay.result.explanation}</p>
        <ol className="ml-5 list-decimal text-sm">{c.replay.result.steps.map(s => <li key={s.uid}>{s.message}</li>)}</ol></>}
      {!c.matches && <p>The saved result is shown above. The simulator has changed since this run.</p>}
    </details>)}
    {run.custom && <div className="mt-2 rounded border border-line p-3"><b>Pupil-written request · AI judgement</b>
      <p>{run.custom.question}</p><p>{run.custom.outcome} · {run.custom.explanation}</p></div>}
  </section>;
}

function Questions({ runs, score }: { runs: PupilRun[]; score?: FinalScore }) {
  const [params, setParams] = useSearchParams();
  const replay = runs.find(r => r.id === params.get('replay'));
  const groups = [...new Set(runs.map(r => r.group))];
  const [choice, setChoice] = useState(replay?.group ?? '');
  const group = groups.includes(choice) ? choice : groups[0];
  const selected = runs.filter(r => r.group === group);
  const builds = selected.filter(r => r.kind === 'build');
  const isAssessment = selected.some(r => r.assessment);
  const latest = builds[0];
  const earlier = builds.slice(1).find(r => r.script.join() !== latest.script.join()) ?? builds[1];
  const attack = selected.find(r => r.kind === 'attack');
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [reply, setReply] = useState<Reply>();
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  function setGroup(value: string) {
    pending.current?.abort();
    pending.current = null;
    setBusy(false); setChoice(value); setReply(undefined); setAsked(''); setQuestion('');
    setParams({}, { replace: true, preventScrollReset: true });
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || !selected.length || pending.current) return;
    setAsked(q); setReply(undefined);
    const compare = q === resultQuestions[1], predict = q === resultQuestions[2], next = q === resultQuestions[3];
    if ((compare && !earlier) || (predict && !attack?.prediction?.trim())) {
      setReply({ text: compare ? 'This task needs two saved build runs for a comparison. Run it again or choose another task.'
        : 'This task has no submitted attack prediction to review. Choose an assessment task where you recorded a prediction.', sources: [] });
      return;
    }
    const suggestion = next ? practiceSuggestion(runs) : undefined;
    const requestedRuns = q.match(/\bruns?\s*#?\s*\d+/gi) ?? [];
    const mentioned = requestedRuns.flatMap(ref => builds.filter(r => r.label === 'Run ' + ref.match(/\d+/)?.[0]));
    if (/\b(first|original) (run|build)\b/i.test(q) && builds.length) mentioned.push(builds[builds.length - 1]);
    const chosen = suggestion ? suggestion.sources.slice(0, 3) : predict ? [attack] : compare ? [earlier, latest]
      : q === resultQuestions[0] ? [selected[0]] : [...new Set([...mentioned, latest, attack, earlier])];
    const sources = chosen.filter((r): r is PupilRun => !!r).slice(0, 3);
    const facts = sources.map(runFacts);
    const final = score && isAssessment && !next ? { total: score.total, band: score.band, categories: score.categories, contributionToTotal: score.parts } : undefined;
    const evidence = { runs: facts, finalAssessmentScore: final, practiceSuggestion: suggestion && {
      title: suggestion.task.title, skill: suggestion.skill, latestBuildsWithThisDifficulty: suggestion.skill ? suggestion.sources.length : undefined } };
    const ctrl = new AbortController();
    pending.current = ctrl;
    setBusy(true);
    try {
      const raw = await askLiteracyAi({ task: 'pupilResults', question: q, evidence }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      const ids = sources.map(r => r.id);
      const answer = parsePupilAnswer(raw, ids);
      if (answer && (!compare || ids.every(id => answer.sources.includes(id)))) {
        setReply({ ...answer, practice: suggestion?.task });
      } else {
        const text = offlinePupilFeedback(q, facts, suggestion);
        setReply({ text, sources: ids, practice: suggestion?.task, unavailable: true });
      }
    } finally {
      if (pending.current === ctrl) { pending.current = null; setBusy(false); }
    }
  }

  return <section className="mt-6 rounded-md border-1.5 border-ink bg-paper-card p-4 sm:p-6" aria-labelledby="pupil-questions">
    <h2 id="pupil-questions" className="text-2xl font-extrabold">Ask about my results</h2>
    {!groups.length ? <p className="mt-2 text-ink-2">Complete a build run or launch an attack to ask about your results here.</p> : <>
      <label className="mt-3 block font-bold" htmlFor="results-task">Task to discuss</label>
      <select id="results-task" className="mt-1 max-w-full rounded border border-line bg-paper px-2 py-2" value={group} onChange={e => setGroup(e.target.value)}>
        {groups.map(g => <option key={g}>{g}</option>)}
      </select>
      <div className="my-4 flex flex-wrap gap-2">{resultQuestions.map(q =>
        <button key={q} className="btn bg-paper text-sm" disabled={busy} onClick={() => { setQuestion(q); void ask(q); }}>{q}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); void ask(question); }}>
        <label htmlFor="result-question" className="block font-bold">Your question</label>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <textarea id="result-question" rows={2} maxLength={300} className="min-w-0 w-full sm:flex-1 rounded border border-line p-2"
            value={question} onChange={e => setQuestion(e.target.value)} />
          <button className="btn bg-signal" disabled={busy || !question.trim()}>Ask AI</button>
        </div>
      </form>
      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="mt-3">Reading your saved results…</p>}
        {reply && <div className="mt-4 rounded border border-line bg-paper p-3">
          <h3 className="font-bold">{asked}</h3>
          {reply.unavailable && <p className="mt-1 text-sm text-ink-2">AI unavailable · Saved results</p>}
          <p className="mt-1 whitespace-pre-line">{reply.text}</p>
          {reply.sources.map(id => { const r = runs.find(item => item.id === id);
            return r && <Link key={id} className="mt-2 block text-sm font-bold underline" to={'?replay=' + encodeURIComponent(id)} preventScrollReset>
              Show replay · {r.group} · {r.label}</Link>; })}
          {reply.practice && <Link className="btn bg-paper-card mt-3" to={'/build/' + reply.practice.id}>Practise {reply.practice.title}</Link>}
          {score && isAssessment && !reply.unavailable && <Link className="block mt-2 text-sm underline" to="/mission">View assessment score</Link>}
        </div>}
      </div>
      {replay && <Replay run={replay} />}
    </>}
  </section>;
}

export default function PupilResultsQuestions() {
  const store = usePracticeStore();
  const practice = store(s => s.progress);
  const attacks = store(s => s.breakProgress);
  const joined = store(s => s.classCode);
  const owner = store(s => s.studentId);
  const presenting = usePresenter(s => s.active);
  const work = useAssessmentSession(s => s.progress);
  const mission = useMission(s => s.mission);
  const ownMission = !presenting && mission.owner === owner && (!mission.classCode || mission.classCode === joined) ? mission : undefined;
  const runs = useMemo(() => pupilRuns(practice, attacks, work, ownMission, owner), [practice, attacks, work, ownMission, owner]);
  return <Questions key={String(presenting) + (owner ?? '')} runs={runs} score={ownMission?.finalResult?.score} />;
}
