import { Link } from 'react-router-dom';
import CompetencyRadar from '../components/Radar';
import Timeline from '../components/Timeline';
import { COMPETENCY_META } from '../data/blocks';
import { CHALLENGES } from '../data/challenges';
import { averageScores, DIMS, feedbackFor, profileChallenge } from '../engine/profile';
import { useSession } from '../store/session';

export default function Profile() {
  const progress = useSession((s) => s.progress);
  const profiles = CHALLENGES.filter((c) => progress[c.id]?.attempts.length).map((c) => ({ c, p: profileChallenge(c.id, progress[c.id]) }));

  if (!profiles.length) {
    return (
      <div className="max-w-xl mx-auto text-center py-24 px-4">
        <div className="text-6xl">🧩</div>
        <h1 className="text-3xl font-extrabold mt-3">No profile yet</h1>
        <p className="text-indigo-900/70 mt-2">Build a helper and run it against the hidden tests. Your AI literacy profile appears here.</p>
        <Link to="/" className="inline-block mt-6 px-6 py-3 rounded-2xl bg-violet-600 text-white font-extrabold">Pick a challenge</Link>
      </div>
    );
  }

  const first = averageScores(profiles.map(({ p }) => p.anticipated));
  const now = averageScores(profiles.map(({ p }) => p.current));
  const reflAll = profiles.flatMap(({ c }) => progress[c.id].reflections);
  const reflAcc = reflAll.length ? Math.round((reflAll.filter((r) => r.correct).length / reflAll.length) * 100) : null;
  const attempts = profiles.reduce((a, { p }) => a + p.attempts, 0);
  const misconceptions = [...new Set(profiles.flatMap(({ p }) => p.misconceptions))];
  const weakest = DIMS.filter((d) => now[d] !== null).sort((a, b) => (now[a] ?? 0) - (now[b] ?? 0))[0];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8" data-testid="profile">
      <div className="text-xs font-extrabold uppercase tracking-wider text-violet-600">My AI literacy profile</div>
      <h1 className="text-4xl font-extrabold">How you think about AI</h1>
      <p className="text-indigo-900/70 mt-1">
        Based on {attempts} run{attempts === 1 ? '' : 's'} across {profiles.length} challenge{profiles.length === 1 ? '' : 's'}. The dashed shape is what you
        <b> anticipated</b> on your first try. The solid shape is where you got to after fixing.
      </p>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 mt-6">
        <div className="bg-white rounded-3xl border-2 border-indigo-100 p-4">
          <CompetencyRadar first={first} now={now} height={360} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 content-start">
          {DIMS.map((d) => {
            const m = COMPETENCY_META[d];
            const v = now[d];
            return (
              <div key={d} className="bg-white rounded-2xl border-2 border-indigo-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-lg">{m.icon} {m.label}</span>
                  <span className="font-display font-extrabold text-2xl" style={{ color: m.color }}>{v ?? '–'}{v !== null && '%'}</span>
                </div>
                <div className="h-2 rounded-full bg-indigo-50 mt-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${v ?? 0}%`, background: m.color }} />
                </div>
                <p className="text-[13px] text-indigo-900/75 mt-2">{feedbackFor(d, v, first[d])}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="bg-indigo-950 text-white rounded-3xl p-5">
          <div className="text-xs uppercase tracking-wider font-extrabold text-indigo-200">Explaining failures</div>
          <div className="font-display text-4xl font-extrabold mt-1">{reflAcc ?? '–'}{reflAcc !== null && '%'}</div>
          <p className="text-sm text-indigo-100/80">of the time you correctly explained why your helper failed. That shows understanding, not trial and error.</p>
        </div>
        <div className="bg-white rounded-3xl border-2 border-indigo-100 p-5">
          <div className="text-xs uppercase tracking-wider font-extrabold text-indigo-900/50">Watch out for</div>
          {misconceptions.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {misconceptions.map((m) => <li key={m} className="flex gap-2"><span>⚠️</span>{m}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-indigo-900/70">No repeated mistakes spotted. Nice!</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-pink-500 text-white rounded-3xl p-5">
          <div className="text-xs uppercase tracking-wider font-extrabold text-white/80">Next time, try…</div>
          <p className="mt-2 font-semibold">
            {weakest
              ? `Your weakest area is ${COMPETENCY_META[weakest].label}. Before you press Run, ask yourself: "${{
                  verification: 'What if the AI just makes something up?',
                  privacy: "Is anyone's personal info about to leave this device?",
                  integrity: 'Is the AI doing the thinking that they should be doing?',
                  bias: 'Who would disagree with this answer?',
                  usefulness: 'Am I blocking questions that are actually fine?',
                }[weakest]}"`
              : 'Try a new challenge.'}
          </p>
          <Link to="/" className="inline-block mt-3 text-sm font-extrabold underline">Try another challenge →</Link>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold mt-10 mb-3">Your journey</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {profiles.map(({ c, p }) => (
          <div key={c.id} className="bg-white rounded-3xl border-2 border-indigo-100 p-5">
            <div className="font-display font-extrabold text-lg">{c.emoji} {c.title}</div>
            <Timeline profile={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
