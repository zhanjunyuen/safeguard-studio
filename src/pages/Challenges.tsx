import { ArrowLeft, Check, Circle, CircleDot, Zap } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePresenter } from '../store/presenter';
import { CHALLENGES } from '../data/challenges';
import { challengeStatus, type Status } from '../engine/progress';
import { DIM_ICON } from '../components/icons';
import { COMPETENCY_META } from '../data/blocks';
import { challengesIn, THEMES } from '../data/themes';
import { useDemoSession, usePracticeStore } from '../store/session';

const STEPS = [
  ['The tests are hidden.', 'Students have to think about what could go wrong before they see it happen.'],
  ['Where a block goes matters.', 'Removing an address after it has been sent to the AI is too late, and the replay shows why.'],
  ['Blocking everything costs marks.', 'A helper that refuses normal questions scores low on usefulness, so "always ask an adult" is not a winning strategy.'],
  ['Students also break other helpers.', 'In Break mode they read a locked helper and plan a few attacks to find its weak spots. Wasted attacks count, so guessing scores badly.'],
  ['Every failure has to be explained.', 'Students say why their helper failed before they can run it again. Teachers see the reasoning as well as the score.'],
];

function jumpToTheme(id: string) {
  const heading = document.getElementById('theme-' + id);
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: 'start' });
}

export default function Challenges({ scrollTo }: { scrollTo?: string } = {}) {
  const useSession = usePracticeStore();
  const nav = useNavigate();
  const progress = useSession(s => s.progress);
  const breakProgress = useSession((s) => s.breakProgress);

  const statusOf = (c: (typeof CHALLENGES)[number]) => challengeStatus(c, progress[c.id], breakProgress[c.id], progress[`${c.id}@2`]);
  useEffect(() => {
    if (scrollTo) document.getElementById(scrollTo)?.scrollIntoView();
  }, [scrollTo]);

  const quickDemo = () => {
    useDemoSession.getState().reset('history');
    usePresenter.setState({ active: true, step: 1, pending: null });
    nav('/build/history');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-7 md:py-10">
      <header className="max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 font-bold underline underline-offset-2"><ArrowLeft size={16} aria-hidden /> Back to start</Link>
        <p className="label text-ink-2 mt-6">Practice · Ages 11 to 14</p>
        <h1 className="text-5xl font-extrabold leading-[0.98] mt-2">Explore all <span className="bg-signal px-1.5 -mx-0.5 box-decoration-clone">challenges.</span></h1>
        <p className="mt-4 text-lg text-ink-2 leading-relaxed">Practise any challenge on your own: build a helper, break one, then try Level 2 with IF blocks. Practice doesn't count towards the assessment.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={quickDemo} className="btn bg-paper-card" data-testid="quick-demo">Try the history demo</button>
        </div>
      </header>

      <section id="challenges" className="mt-10">
        <div className="flex items-end justify-between flex-wrap gap-2 border-b-1.5 border-ink pb-3 mb-6">
          <h2 className="text-3xl font-extrabold">Practice challenges</h2>
          <p className="text-ink-2">{CHALLENGES.length} challenges in {THEMES.length} themes. Each has six hidden tests you only see after your first run.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <nav aria-label="Practice themes" className="lg:sticky lg:top-4 self-start">
            <label className="flex flex-wrap items-center gap-2 font-bold lg:hidden">Jump to theme
              <select className="max-w-full rounded border-1.5 border-ink bg-paper-card p-2" defaultValue=""
                onChange={e => { jumpToTheme(e.target.value); e.target.value = ''; }}>
                <option disabled value="">Choose a theme</option>
                {THEMES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <div className="hidden lg:block"><p className="label mb-2">Practice themes</p>
              {THEMES.map(t => <button key={t.id} className="block min-h-11 w-full border-t border-line py-2 text-left font-bold hover:underline"
                onClick={() => jumpToTheme(t.id)}>{t.title}</button>)}
            </div>
          </nav>
          <div className="min-w-0">
        {THEMES.map((t, ti) => {
          const list = challengesIn(t.id);
          const done = list.filter((c) => statusOf(c).allDone).length;
          const Icon = DIM_ICON[t.competency];
          return (
        <section key={t.id} className="mt-10 first:mt-0" aria-labelledby={`theme-${t.id}`} data-testid={`theme-${t.id}`}>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div className="max-w-2xl">
              <p className="label text-ink-3">Theme {ti + 1}</p>
              <h3 tabIndex={-1} id={`theme-${t.id}`} className="text-2xl font-extrabold flex items-center gap-2 mt-0.5">
                <Icon size={22} aria-hidden style={{ color: COMPETENCY_META[t.competency].color }} /> {t.title}
              </h3>
              <p className="text-ink-2 mt-1">{t.learn}</p>
            </div>
            <div className="text-right">
              {done === list.length ? (
                <span className="stamp text-pass text-xs">Theme complete</span>
              ) : (
                <span className="text-sm font-bold text-ink-2">{done} of {list.length} complete</span>
              )}
              <div className="mt-1.5 flex gap-1 justify-end" aria-hidden>
                {list.map((c) => (
                  <span key={c.id} className={`w-6 h-2 rounded-sm border border-ink ${statusOf(c).allDone ? 'bg-pass' : statusOf(c).buildState !== 'todo' || statusOf(c).breakState !== 'todo' ? 'bg-partial-soft' : 'bg-paper'}`} />
                ))}
              </div>
            </div>
          </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => {
            const i = CHALLENGES.indexOf(c);
            const { best, build, brk, buildState, breakState, allDone, level2, level2State } = statusOf(c);
            return (
              <div
                key={c.id}
                className={`flex flex-col border-1.5 border-ink rounded-md p-5 shadow-hard ${allDone ? 'bg-pass-soft' : 'bg-paper-card'}`}
                data-testid={`card-${c.id}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="label text-ink-3">Challenge {String(i + 1).padStart(2, '0')}</span>
                  {allDone ? (
                    <span className="stamp text-pass text-[11px]">Complete</span>
                  ) : (
                    <span className="w-3 h-3 rounded-full border-1.5 border-ink" style={{ background: c.accent }} aria-hidden />
                  )}
                </div>
                <h3 className="text-2xl font-extrabold leading-tight mt-3">{c.title}</h3>
                <p className="text-sm font-bold text-ink-2 mt-1">{c.audience}</p>
                <p className="mt-3 text-ink-2 leading-relaxed">{c.story}</p>
                <dl className="mt-auto pt-5 space-y-1.5 text-sm" aria-label="Your progress">
                  <StatusLine
                    label="Build"
                    state={buildState}
                    detail={
                      best === null
                        ? 'Not started'
                        : buildState === 'done'
                          ? `Done · all ${c.tests.length} passed, useful ${build.bestUseful}`
                          : build.bestUseful !== null
                            ? `All passed, but useful ${build.bestUseful} (needs ${build.target})`
                            : `Best so far: ${best} of ${c.tests.length} passed`
                    }
                  />
                  <StatusLine
                    label="Break"
                    state={breakState}
                    detail={!brk ? 'Not started' : breakState === 'done' ? `Done · found all ${brk.total} weak spots` : `Found ${brk.found} of ${brk.total} weak spots`}
                  />
                  <StatusLine
                    label="Level 2"
                    state={level2State === 'locked' ? 'todo' : level2State}
                    detail={
                      level2State === 'locked'
                        ? 'Unlocks when Build is done'
                        : level2State === 'done'
                          ? `Done · useful ${level2.bestUseful}`
                          : level2State === 'todo'
                            ? 'Ready: use IF blocks'
                            : level2.bestUseful !== null
                              ? `All passed, but useful ${level2.bestUseful} (needs ${level2.target})`
                              : `Best so far: ${level2.best} of ${level2.total} passed`
                    }
                  />
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => nav(`/build/${c.id}`)} className="btn bg-signal text-sm justify-center" data-testid={`challenge-${c.id}`}>
                    Build a helper
                  </button>
                  <button onClick={() => nav(`/break/${c.id}`)} className="btn bg-paper-card text-sm justify-center" data-testid={`break-${c.id}`}>
                    <Zap size={15} aria-hidden /> Break one
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </section>
          );
        })}
          </div>
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-[280px_1fr] gap-8">
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">How the practice challenges work</h2>
          <p className="text-ink-2 mt-2">The score comes from what students build and fix, rather than what they say they would do.</p>
        </div>
        <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="border-t-1.5 border-ink pt-3">
              <span className="label text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="text-lg font-extrabold mt-1">{t}</h3>
              <p className="text-ink-2 mt-1 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}


function StatusLine({ label, state, detail }: { label: string; state: Status; detail: string }) {
  const Icon = state === 'done' ? Check : state === 'started' ? CircleDot : Circle;
  const cls = state === 'done' ? 'text-pass' : state === 'started' ? 'text-partial' : 'text-ink-3';
  return (
    <div className="flex items-center gap-2" data-state={state}>
      <dt className="w-16 shrink-0 font-bold text-ink">{label}</dt>
      <dd className={`flex items-center gap-1.5 font-bold ${cls}`}>
        <Icon size={15} strokeWidth={3} aria-hidden />
        {detail}
      </dd>
    </div>
  );
}
