import { ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMission } from '../store/mission';
import Block from '../components/Block';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
import { CHALLENGES } from '../data/challenges';
import { newUid, useSession } from '../store/session';

const STEPS = [
  ['The tests are hidden.', 'Students have to think about what could go wrong before they see it happen.'],
  ['Where a block goes matters.', 'Removing an address after it has been sent to the AI is too late, and the replay shows why.'],
  ['Blocking everything costs marks.', 'A helper that refuses normal questions scores low on usefulness, so "always ask an adult" is not a winning strategy.'],
  ['Students also break other helpers.', 'In Break mode they read a locked helper and plan a few attacks to find its weak spots. Wasted attacks count, so guessing scores badly.'],
  ['Every failure has to be explained.', 'Students say why their helper failed before they can run it again. Teachers see the reasoning as well as the score.'],
];

export default function Home() {
  const nav = useNavigate();
  const phase = useMission(s => s.mission.phase);
  const { progress, reset, setScript } = useSession();

  const quickDemo = () => {
    reset('history');
    setScript('history', [{ uid: newUid('ask_ai'), type: 'ask_ai' }]);
    nav('/build/history');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-12">
      <section className="grid md:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <p className="label text-ink-2 mb-4">AI literacy assessment · Ages 11 to 14</p>
          <h1 className="text-5xl md:text-[64px] font-extrabold leading-[0.98]">
            Build an AI helper for your <span className="bg-signal px-1.5 -mx-0.5 box-decoration-clone">school community.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-2 max-w-[34rem] leading-relaxed">
            Build one helper for six assigned school services. Test it on every request in order, then decide when people can rely on it.
            Its safeguards share a budget across six school services.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => nav('/mission')} className="btn bg-signal text-ink">
              {phase === 'brief' ? 'Start the assessment' : phase === 'complete' || phase === 'expired' ? 'View assessment evidence' : 'Resume assessment'} <ArrowRight size={18} aria-hidden />
            </button>
            <button onClick={quickDemo} className="btn bg-paper-card" data-testid="quick-demo">Try the history demo</button>
          </div>
        </div>

        <div className="relative">
          <div className="graph border-1.5 border-ink rounded-md p-8 pb-10 flex justify-center">
            <div>
              {[
                <Block key="t" kind="trigger" shape="hat" label="When someone asks…" color={TRIGGER_COLOR} textColor="#16161A" width={270} />,
                <Block key="a" kind="ask_ai" label="Ask AI" color={BLOCKS.ask_ai.color} width={270} />,
                <Block key="r" kind="reply" shape="cap" label="Reply to them" color={REPLY_COLOR} width={270} highlight="stop" />,
              ].map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
                  {b}
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, rotate: 0, y: 10 }}
            animate={{ opacity: 1, rotate: 2, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute -bottom-10 right-4 w-[290px] bg-paper-card border-1.5 border-ink rounded shadow-hard p-4"
          >
            <div className="flex items-center justify-between">
              <span className="label text-ink-3">Test 1 of 6</span>
              <span className="stamp text-fail text-xs">Fail</span>
            </div>
            <p className="mt-2 text-sm text-ink-2">"When was the Battle of Hastings?"</p>
            <p className="mt-1 text-[15px] font-bold">"It took place in 1067, when William of Normandy defeated King Harold II."</p>
          </motion.div>
        </div>
      </section>

      <section id="challenges" className="mt-28">
        <div className="flex items-end justify-between flex-wrap gap-2 border-b-1.5 border-ink pb-3 mb-6">
          <h2 className="text-3xl font-extrabold">Practice challenges</h2>
          <p className="text-ink-2">Each one has six hidden tests. You only see them after your first run.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {CHALLENGES.map((c, i) => {
            const p = progress[c.id];
            const best = p?.attempts.length ? Math.max(...p.attempts.map((a) => a.results.filter((r) => r.outcome === 'pass').length)) : null;
            return (
              <div
                key={c.id}
                className="flex flex-col bg-paper-card border-1.5 border-ink rounded-md p-5 shadow-hard"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="label text-ink-3">Challenge {String(i + 1).padStart(2, '0')}</span>
                  <span className="w-3 h-3 rounded-full border-1.5 border-ink" style={{ background: c.accent }} aria-hidden />
                </div>
                <h3 className="text-2xl font-extrabold leading-tight mt-3">{c.title}</h3>
                <p className="text-sm font-bold text-ink-2 mt-1">{c.audience}</p>
                <p className="mt-3 text-ink-2 leading-relaxed">{c.story}</p>
                <div className="mt-auto pt-5 text-sm font-bold text-ink-3">
                  {best !== null ? <span className="text-pass">Best build: {best} of {c.tests.length} passed</span> : '6 hidden tests'}
                </div>
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
