import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Block from '../components/Block';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
import { CHALLENGES } from '../data/challenges';
import { newUid, useSession } from '../store/session';

export default function Home() {
  const nav = useNavigate();
  const { progress, reset, setScript } = useSession();

  const quickDemo = () => {
    reset('history');
    setScript('history', [{ uid: newUid('ask_ai'), type: 'ask_ai' }]);
    nav('/build/history');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10">
      <section className="grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div>
          <p className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold uppercase tracking-wider mb-4">
            AI literacy, shown by doing
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.02] text-indigo-950">
            Build an AI helper.<br />
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">See if it survives.</span>
          </h1>
          <p className="mt-5 text-lg text-indigo-900/80 max-w-xl">
            Snap together safeguard blocks, then run your helper against <b>hidden tests</b>: made-up facts, leaked addresses,
            “write my essay” requests and loaded questions. Watch what breaks, fix it, and see your AI literacy profile grow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={quickDemo} className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-extrabold shadow-lg shadow-violet-300 hover:bg-violet-700 transition" data-testid="quick-demo">
              ⚡ Quick demo
            </button>
            <a href="#challenges" className="px-6 py-3 rounded-2xl bg-white border-2 border-indigo-100 font-extrabold hover:border-violet-300 transition">
              Pick a challenge ↓
            </a>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="workspace rounded-3xl border-2 border-indigo-100 p-8 flex justify-center">
          <div>
            {[
              <Block key="t" shape="hat" label="When someone asks…" icon="💬" color={TRIGGER_COLOR} textColor="#3b2a00" width={280} />,
              <Block key="p" label={BLOCKS.remove_pii.label} icon={BLOCKS.remove_pii.icon} color={BLOCKS.remove_pii.color} width={280} />,
              <Block key="a" label="Ask AI" icon="✨" color={BLOCKS.ask_ai.color} width={280} />,
              <Block key="c" label={BLOCKS.check_source.label} icon={BLOCKS.check_source.icon} color={BLOCKS.check_source.color} width={280} highlight="acted" />,
              <Block key="r" shape="cap" label="Reply" icon="📤" color={REPLY_COLOR} width={280} />,
            ].map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12, type: 'spring' }}>
                {b}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section id="challenges" className="mt-16">
        <h2 className="text-3xl font-extrabold mb-1">Choose a challenge</h2>
        <p className="text-indigo-900/70 mb-6">Each one hides 6 tests. You won’t see them until you run your helper, so think ahead.</p>
        <div className="grid md:grid-cols-3 gap-5">
          {CHALLENGES.map((c) => {
            const p = progress[c.id];
            const last = p?.attempts.at(-1);
            return (
              <motion.button
                whileHover={{ y: -4 }}
                key={c.id}
                onClick={() => nav(`/build/${c.id}`)}
                className="flex flex-col text-left bg-white rounded-3xl p-6 border-2 border-indigo-100 hover:border-violet-300 shadow-sm transition"
                data-testid={`challenge-${c.id}`}
              >
                <div className="w-14 h-14 rounded-2xl grid place-items-center text-3xl mb-4" style={{ background: c.accent + '33' }}>{c.emoji}</div>
                <h3 className="text-2xl font-extrabold leading-tight">{c.title}</h3>
                <p className="text-xs font-extrabold uppercase tracking-wider text-violet-600 mt-1">{c.audience}</p>
                <p className="mt-3 text-indigo-900/75 text-[15px]">{c.story}</p>
                <div className="mt-auto pt-5 w-full flex items-center justify-between text-sm font-bold">
                  <span className="text-indigo-900/60">🔒 {c.tests.length} hidden tests</span>
                  {last ? (
                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      Best so far: {Math.max(...p.attempts.map((a) => a.results.filter((r) => r.outcome === 'pass').length))}/{c.tests.length}
                    </span>
                  ) : (
                    <span className="text-violet-600">Start →</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="mt-16 grid md:grid-cols-4 gap-4">
        {[
          ['🙈', 'Hidden tests', 'Students have to anticipate what could go wrong, not just react to it.'],
          ['🧠', 'Every block is a decision', 'When to trust AI, when to check it, and when to protect someone.'],
          ['⚖️', 'Safe AND useful', 'Over-building is penalised. "Ask a grown-up every time" doesn’t win.'],
          ['✍️', 'Explain before you fix', 'After each failure, students say why it failed. No blind trial and error.'],
        ].map(([i, t, d]) => (
          <div key={t} className="bg-white/70 rounded-2xl p-5 border border-indigo-100">
            <div className="text-2xl">{i}</div>
            <h4 className="font-display font-extrabold text-lg mt-1">{t}</h4>
            <p className="text-sm text-indigo-900/70">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
