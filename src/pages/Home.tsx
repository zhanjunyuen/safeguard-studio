import { ArrowRight, Check, Circle, CircleDot, Play, Zap } from 'lucide-react';
import helperPortrait from '../assets/companions/community.webp';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMission } from '../store/mission';
import { usePresenter } from '../store/presenter';
import Block from '../components/Block';
import JoinClass from '../components/JoinClass';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
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

export default function Home({ scrollTo }: { scrollTo?: string } = {}) {
  const useSession = usePracticeStore();
  const nav = useNavigate();
  const phase = useMission(s => s.mission.phase);
  const progress = useSession(s => s.progress);
  const presenting = usePresenter(s => s.active);
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
    <div className="studio-home mx-auto max-w-[1280px] px-4 py-5 sm:px-8 sm:py-8">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="label text-ink-2">AI literacy assessment · Ages 11 to 14</p>
          <h1>Build your school’s <span>AI helper.</span></h1>
          <p className="max-w-lg text-ink-2 leading-relaxed">Design safeguards for six school services. Test your helper, see where it goes wrong, and decide what’s ready to release.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {!presenting && <button onClick={() => nav('/mission')} className="btn bg-signal text-ink">
              {phase === 'brief' ? 'Start the assessment' : phase === 'complete' || phase === 'expired' ? 'View assessment evidence' : 'Resume assessment'} <ArrowRight size={17} aria-hidden />
            </button>}
            <button onClick={() => document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth' })} className="btn bg-paper-card">See all challenges</button>
          </div>
          {!presenting && <JoinClass />}
        </div>
        <div className="hero-example">
          <div className="hero-graph">
            <div className="example-stack">
              <Block kind="trigger" shape="hat" label="When someone asks…" color={TRIGGER_COLOR} textColor="#16161A" width={202} />
              <Block kind="ask_ai" label="Ask AI" color={BLOCKS.ask_ai.color} width={202} />
              <Block kind="reply" shape="cap" label="Reply to them" color={REPLY_COLOR} width={202} />
            </div>
            <img src={helperPortrait} alt="" width="360" height="360" className="hero-helper" />
          </div>
          <div className="demo-footer">
            <details><summary className="text-sm font-bold cursor-pointer">Example test result</summary>
              <div className="pt-2 text-sm"><b className="text-fail">Test 1 of 6 · Fail</b>
                <p>“When was the Battle of Hastings?”</p><p>Helper reply · “It took place in 1067, when William of Normandy defeated King Harold II.”</p></div>
            </details>
            <button onClick={quickDemo} className="demo-link" data-testid="quick-demo"><Play size={15} aria-hidden />Try the history demo</button>
          </div>
        </div>
      </section>

      <section id="challenges" className="mt-12 scroll-mt-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-3xl font-extrabold">Practice challenges</h2>
            <p className="text-ink-2 mt-1">{CHALLENGES.length} challenges in {THEMES.length} themes. Each has six hidden tests to try.</p></div>
          <label className="flex items-center gap-2 text-sm font-bold">Jump to theme
            <select defaultValue="" className="studio-select" onChange={e => {
              const heading = document.getElementById('theme-' + e.target.value);
              heading?.focus({ preventScroll: true });
              heading?.scrollIntoView({ block: 'start' });
              e.target.value = '';
            }}>
              <option value="" disabled>Choose a theme</option>
              {THEMES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        </div>
        {THEMES.map(t => {
          const list = challengesIn(t.id);
          const done = list.filter((c) => statusOf(c).allDone).length;
          const Icon = DIM_ICON[t.competency];
          return (
        <section key={t.id} className="mt-8 border-t border-line pt-6" aria-labelledby={`theme-${t.id}`} data-testid={`theme-${t.id}`}>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div className="max-w-2xl">
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => {
            const { best, build, brk, buildState, breakState, allDone, level2, level2State } = statusOf(c);
            return (
              <div
                key={c.id}
                className={`challenge-card flex flex-col rounded-md p-5 ${allDone ? 'bg-pass-soft' : 'bg-paper-card'}`}
                data-testid={`card-${c.id}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="challenge-icon" style={{ backgroundColor: c.accent + '22' }} aria-hidden>{c.emoji}</span>
                  {allDone ? (
                    <span className="stamp text-pass text-[11px]">Complete</span>
                  ) : null}
                </div>
                <h3 className="text-2xl font-extrabold leading-tight mt-3">{c.title}</h3>
                <p className="text-sm font-bold text-ink-2 mt-1">{c.audience}</p>
                <p className="mt-3 text-ink-2 leading-relaxed">{c.story}</p>
                <dl className="mt-auto pt-4 pb-3 border-b border-line space-y-1.5 text-sm" aria-label="Your progress">
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
      </section>

      <section className="mt-24 grid md:grid-cols-[280px_1fr] gap-8">
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">How the practice challenges work</h2>
          <p className="text-ink-2 mt-2">The score comes from what students build and fix, rather than what they say they would do.</p>
        </div>
        <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {STEPS.map(([t, d]) => (
            <li key={t} className="border-t-1.5 border-ink pt-3">
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
