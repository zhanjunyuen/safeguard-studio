import type { ChallengeProfile } from '../engine/profile';
import { COMPETENCY_META } from '../data/blocks';

export default function Timeline({ profile }: { profile: ChallengeProfile }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 my-3 text-xs font-bold">
        {profile.fixedFirst && <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800">🥇 Fixed first: {profile.fixedFirst}</span>}
        {profile.neverNoticed.map((d) => (
          <span key={d} className="px-2 py-1 rounded-full bg-rose-50 text-rose-800">👀 Never solved: {COMPETENCY_META[d].label}</span>
        ))}
      </div>
      <ol className="relative border-l-2 border-indigo-100 ml-2 space-y-4">
        {profile.timeline.map((t) => (
          <li key={t.attempt} className="pl-4 relative">
            <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${t.passed === t.total ? 'bg-emerald-500' : 'bg-violet-500'}`} />
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold">Run {t.attempt}</span>
              <span className="text-sm text-indigo-900/60">passed {t.passed}/{t.total}</span>
            </div>
            <div className="text-[13px] space-y-0.5 mt-0.5">
              {t.added.map((a) => <div key={a} className="text-emerald-700">+ {a}</div>)}
              {t.removed.map((a) => <div key={a} className="text-rose-700">− {a}</div>)}
              {t.reordered && <div className="text-violet-700">↕ Reordered blocks</div>}
              {t.newlyFixed.length > 0 && <div className="text-emerald-800 font-bold">✓ Now passing: {t.newlyFixed.join(', ')}</div>}
              {t.failed.length > 0 && <div className="text-indigo-900/60">Still failing: {t.failed.join(', ')}</div>}
              {t.reflection && (
                <div className={`mt-1 rounded-lg px-2 py-1 ${t.reflection.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  💭 Explained: “{t.reflection.chosen}” {t.reflection.correct ? '✓' : `✗ (actually: ${t.reflection.expected})`}
                  {t.reflection.text && <div className="italic opacity-80">“{t.reflection.text}”</div>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
