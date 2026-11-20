import { ArrowRight, Compass, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import companion from '../assets/companions/community.webp';
import Block from '../components/Block';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
import { cleanSettings } from '../engine/assessmentSettings';
import { findClass } from '../lib/sync';
import { useMission } from '../store/mission';
import { usePresenter } from '../store/presenter';
import { useDemoSession, useSession } from '../store/session';
import { useTeacherSettings } from '../store/teacherSettings';

/**
 * The start page: one thing to do. Enter the class code from your teacher (or leave it blank)
 * and start the assessment. The demo and the practice challenges are smaller, secondary links.
 */
export default function Home() {
  const nav = useNavigate();
  const { mission: m, update, restart } = useMission();
  const joinedCode = useSession((s) => s.classCode);
  const deviceSettings = useTeacherSettings((s) => s.settings);
  const [code, setCode] = useState(m.classCode ?? joinedCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = m.phase !== 'brief';
  const ended = m.phase === 'complete' || m.phase === 'expired';

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let classCode: string | undefined;
    let settings = deviceSettings;
    if (code.trim()) {
      setBusy(true);
      const found = await findClass(code);
      setBusy(false);
      if ('error' in found) { setError(found.error); return; }
      classCode = found.code;
      if (found.settings) settings = cleanSettings(found.settings);
    }
    if (inProgress) restart();
    update({ classCode, settings, phase: 'brief' });
    nav('/mission');
  }

  const quickDemo = () => {
    useDemoSession.getState().reset('history');
    usePresenter.setState({ active: true, step: 1, pending: null });
    nav('/build/history');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-14">
      <section className="grid lg:grid-cols-[1.15fr_minmax(0,1fr)] gap-8 md:gap-12 items-center">
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="label text-ink-2">AI literacy assessment · Ages 11 to 14</p>
            <img src={companion} alt="" className="w-16 h-16 object-contain mix-blend-multiply sm:hidden" />
          </div>
          <h1 className="text-5xl md:text-[64px] font-extrabold leading-[0.98]">
            Build an AI helper for your <span className="bg-signal px-1.5 -mx-0.5 box-decoration-clone">school community.</span>
          </h1>

          {inProgress && (
            <div className="mt-8 rounded-md border-1.5 border-ink bg-paper-card p-5 shadow-hard" data-testid="resume-card">
              <p className="label text-ink-3">{ended ? 'Assessment finished' : 'Assessment in progress'}</p>
              <p className="mt-1 text-lg font-bold">{ended ? (m.finalResult ? `Final score ${m.finalResult.score.total}/100 · ${m.finalResult.score.band}` : 'Your results are ready.') : `${m.completed?.length ?? 0} of ${m.assigned?.length ?? 6} challenges complete.`}</p>
              <button onClick={() => nav('/mission')} className="btn bg-signal mt-4" data-testid="resume-assessment">
                {ended ? 'See my results' : 'Resume assessment'} <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          )}

          <form onSubmit={start} className={`mt-8 ${inProgress ? 'rounded-md border border-line p-4' : ''}`} aria-label="Start the assessment">
            {inProgress && <p className="font-bold mb-3">Or start a new assessment (this replaces the one above)</p>}
            <label className="block font-bold" htmlFor="class-code">Class code <span className="font-normal text-ink-2">from your teacher</span></label>
            <div className="mt-2 flex flex-wrap gap-3">
              <input id="class-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} autoComplete="off" placeholder="e.g. DEMO8B"
                className="w-44 rounded border-1.5 border-ink bg-paper-card px-3 py-2.5 font-mono text-lg uppercase" data-testid="class-code" />
              <button disabled={busy} className={`btn ${inProgress ? 'bg-paper-card' : 'bg-signal'} text-ink text-lg`} data-testid="start-assessment-home">
                {busy ? 'Finding your class…' : 'Start assessment'} <ArrowRight size={18} aria-hidden />
              </button>
            </div>
            {error && <p className="mt-2 text-fail font-bold" role="alert">{error}</p>}
            <p className="mt-2 text-sm text-ink-3">No code? Leave it blank to start on your own. Only your first name and class code are saved.</p>
          </form>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <button onClick={quickDemo} className="inline-flex items-center gap-1.5 font-bold underline underline-offset-2" data-testid="quick-demo">
              <PlayCircle size={17} aria-hidden /> Watch the demo
            </button>
            <Link to="/challenges" className="inline-flex items-center gap-1.5 font-bold underline underline-offset-2" data-testid="explore-challenges">
              <Compass size={17} aria-hidden /> Explore all challenges
            </Link>
            <Link to="/setup" className="text-ink-2 underline underline-offset-2">Teachers: set up an assessment</Link>
          </div>
        </div>

        <div className="relative hidden sm:block" aria-hidden>
          <div className="graph border-1.5 border-ink rounded-md p-4 pb-8 flex items-center justify-around gap-1">
            <div>
              {[
                <Block key="t" kind="trigger" shape="hat" label="When someone asks…" color={TRIGGER_COLOR} textColor="#16161A" width={270} />,
                <Block key="a" kind="ask_ai" label="Ask AI" color={BLOCKS.ask_ai.color} width={270} />,
                <Block key="r" kind="reply" shape="cap" label="Reply to them" color={REPLY_COLOR} width={270} highlight="stop" />,
              ].map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>{b}</motion.div>
              ))}
            </div>
            <img src={companion} alt="" width={360} height={360} className="w-[30%] max-w-[180px] object-contain mix-blend-multiply" />
          </div>
          <motion.div initial={{ opacity: 0, rotate: 0, y: 10 }} animate={{ opacity: 1, rotate: 2, y: 0 }} transition={{ delay: 0.5 }}
            className="relative -mt-6 ml-auto mr-3 max-w-[290px] bg-paper-card border-1.5 border-ink rounded shadow-hard p-4">
            <div className="flex items-center justify-between">
              <span className="label text-ink-3">Test 1 of 6</span>
              <span className="stamp text-fail text-xs">Fail</span>
            </div>
            <p className="mt-2 text-sm text-ink-2">"When was the Battle of Hastings?"</p>
            <p className="mt-1 text-[15px] font-bold">"It took place in 1067, when William of Normandy defeated King Harold II."</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
