import CurveballReview, { recordedPredictions } from '../components/CurveballReview';
import PupilResultsQuestions from '../components/PupilResultsQuestions';
import { MissionResultLink } from '../components/MissionReport';
import { useMemo } from 'react';
import { personalPractice } from '../engine/pupilResults';
import { usePupilMission } from '../store/mission';
import { Link } from 'react-router-dom';
import { DIM_ICON } from '../components/icons';
import CompetencyRadar from '../components/Radar';
import Timeline from '../components/Timeline';
import { COMPETENCY_META } from '../data/blocks';
import { CHALLENGES, practiceLevels, practiceTitle } from '../data/challenges';
import { breakSummary } from '../engine/breaker';
import { challengeStatus } from '../engine/progress';
import { challengesIn, THEMES } from '../data/themes';
import { averageScores, DIMS, feedbackFor, overallProfile, type Dim } from '../engine/profile';
import { usePracticeStore } from '../store/session';

const NEXT_QUESTION: Record<Dim, string> = {
  verification: 'What if the AI just makes this up?',
  privacy: "Is anyone's personal info about to be sent?",
  integrity: 'Is the AI doing the thinking they should be doing?',
  bias: 'Who would disagree with this answer?',
  judgement: 'Should a chatbot be handling this at all?',
  manipulation: 'Is someone trying to trick me, or trick the AI?',
  usefulness: 'Am I blocking questions that are actually fine?',
};

export default function Profile() {
  const useSession = usePracticeStore();
  const mission = usePupilMission();
  const owner = useSession(s => s.studentId);
  const history = useSession((s) => s.progress);
  const attacks = useSession(s => s.breakProgress);
  const { progress, breakProgress } = useMemo(() => personalPractice(history, attacks, owner), [history, attacks, owner]);
  const predictions = useMemo(() => recordedPredictions(history, owner, mission), [history, owner, mission]);
  const breaks = practiceLevels(CHALLENGES).map((c) => ({ c, s: breakSummary(c, breakProgress[c.id] ?? []) })).filter((x) => x.s);
  const summary = overallProfile(progress);
  const profiles = summary.parts;

  if (!profiles.length && !breaks.length) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4">
        <h1 className="text-4xl font-extrabold">{!predictions.length && (!mission || mission.phase === 'brief') ? 'No results yet' : 'My results'}</h1>
        <MissionResultLink />
        <CurveballReview key={owner} rows={predictions} />
        <PupilResultsQuestions />
        <p className="text-ink-2 mt-3 text-lg">Practice results appear here after you run a helper against the hidden tests.</p>
        <Link to="/" className="btn bg-signal mt-6">Choose a challenge</Link>
      </div>
    );
  }

  const first = averageScores(profiles.map(p => p.anticipated));
  const now = averageScores(profiles.map(p => p.current));
  const { reflectionAccuracy: reflAcc, attempts, misconceptions } = summary;
  const weakest = DIMS.filter((d) => now[d] !== null).sort((a, b) => (now[a] ?? 0) - (now[b] ?? 0))[0];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10" data-testid="profile">
      <h1 className="text-5xl font-extrabold">My results</h1>
      <MissionResultLink />
      <p className="text-ink-2 mt-2 text-lg max-w-3xl">
        From {attempts} run{attempts === 1 ? '' : 's'} across {summary.done.length} challenge{summary.done.length === 1 ? '' : 's'}.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="rounded-md border-1.5 border-ink bg-ink text-paper p-5">
          <div className="label text-paper/70">Explaining failures</div>
          <div className="font-mono text-4xl font-bold mt-2">{reflAcc ?? '–'}{reflAcc !== null && '%'}</div>
          <p className="text-paper/85 mt-1">of your explanations for why a test failed were right.</p>
        </div>
        <div className="rounded-md border-1.5 border-ink bg-paper-card p-5">
          <div className="label text-ink-2">Mistakes to watch for</div>
          {misconceptions.length ? (
            <ul className="mt-2 space-y-1.5 list-disc pl-5">{misconceptions.map((m) => <li key={m}>{m}</li>)}</ul>
          ) : (
            <p className="mt-2 text-ink-2">Nothing that came up more than once.</p>
          )}
        </div>
        <div className="rounded-md border-1.5 border-ink bg-signal p-5">
          <div className="label">Before your next run</div>
          {weakest && (
            <p className="mt-2 text-lg font-bold leading-snug">
              Your lowest score is {COMPETENCY_META[weakest].label.toLowerCase()}. Ask yourself: "{NEXT_QUESTION[weakest]}"
            </p>
          )}
          <Link to="/" className="inline-block mt-3 font-bold underline underline-offset-2">Try another challenge</Link>
        </div>
      </div>

      <CurveballReview key={owner} rows={predictions} />
      <PupilResultsQuestions />

      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6 mt-8">
        <div className="rounded-md border-1.5 border-ink bg-paper-card p-4">
          <p className="text-sm text-ink-2">The dashed line shows your first run. The yellow shape shows your latest run.</p>
          <CompetencyRadar first={first} now={now} height={360} />
        </div>
        <div className="rounded-md border-1.5 border-ink bg-paper-card divide-y-1.5 divide-line">
          {DIMS.map((d) => {
            const m = COMPETENCY_META[d];
            const Icon = DIM_ICON[d];
            const v = now[d];
            return (
              <div key={d} className="p-4">
                <div className="flex items-center gap-3">
                  <Icon size={20} aria-hidden style={{ color: m.color }} />
                  <span className="font-display font-bold text-lg flex-1">{m.label}</span>
                  <span className="font-mono font-bold text-xl">{v ?? '–'}</span>
                </div>
                <div className="h-2 rounded-sm bg-paper-deep mt-2 overflow-hidden" aria-hidden>
                  <div className="h-full" style={{ width: `${v ?? 0}%`, background: m.color }} />
                </div>
                <p className="text-ink-2 mt-2 leading-snug">{feedbackFor(d, v, first[d])}</p>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="text-3xl font-extrabold mt-12 mb-4">Themes</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="theme-progress">
        {THEMES.map((t) => {
          const list = challengesIn(t.id);
          const done = list.filter((c) => challengeStatus(c, progress[c.id], breakProgress[c.id]).allDone).length;
          const Icon = DIM_ICON[t.competency];
          const complete = done === list.length;
          return (
            <div key={t.id} className={`rounded-md border-1.5 border-ink p-4 ${complete ? 'bg-pass-soft' : 'bg-paper-card'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-lg flex items-center gap-2">
                  <Icon size={18} aria-hidden style={{ color: COMPETENCY_META[t.competency].color }} /> {t.title}
                </span>
                {complete && <span className="stamp text-pass text-[10px]">Badge</span>}
              </div>
              <div className="h-2 rounded-sm bg-paper-deep mt-2 overflow-hidden" aria-hidden>
                <div className="h-full bg-pass" style={{ width: `${(done / list.length) * 100}%` }} />
              </div>
              <p className="text-sm text-ink-2 mt-1.5">{done} of {list.length} challenges complete (build and break)</p>
            </div>
          );
        })}
      </div>

      <h2 className="text-3xl font-extrabold mt-12 mb-4">Spotting weak spots</h2>
      {breaks.length ? (
        <div className="grid md:grid-cols-3 gap-4">
          {breaks.map(({ c, s }) => (
            <div key={c.id} className="rounded-md border-1.5 border-ink bg-paper-card p-5">
              <h3 className="font-extrabold">{c.title}</h3>
              <div className="font-mono text-3xl font-bold mt-2">{s!.found}/{s!.total}</div>
              <p className="text-ink-2 text-sm mt-1">weak spots found in {s!.attempts} attempt{s!.attempts === 1 ? '' : 's'}. {s!.precision}% of your attacks broke the helper.</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-2">You haven't tried Break mode yet. On any challenge, choose "Break one" to find the weak spots in someone else's helper.</p>
      )}

      <h2 className="text-3xl font-extrabold mt-12 mb-4">Run by run</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {profiles.map(p => (
          <div key={p.challengeId} className="rounded-md border-1.5 border-ink bg-paper-card p-5">
            <h3 className="text-xl font-extrabold">{practiceTitle(p.challengeId)}</h3>
            <Timeline profile={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
