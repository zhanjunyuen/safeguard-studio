import { COMPETENCY_META } from '../data/blocks';
import type { ChallengeProfile } from '../engine/profile';

export default function Timeline({ profile }: { profile: ChallengeProfile }) {
  return (
    <div>
      {(profile.fixedFirst || profile.neverNoticed.length > 0) && (
        <dl className="my-3 grid gap-1 text-sm">
          {profile.fixedFirst && (
            <div className="flex gap-2"><dt className="font-bold w-28 shrink-0">Fixed first</dt><dd className="text-pass font-bold">{profile.fixedFirst}</dd></div>
          )}
          {profile.neverNoticed.length > 0 && (
            <div className="flex gap-2"><dt className="font-bold w-28 shrink-0">Never solved</dt><dd className="text-fail font-bold">{profile.neverNoticed.map((d) => COMPETENCY_META[d].label).join(', ')}</dd></div>
          )}
        </dl>
      )}
      <ol className="relative border-l-1.5 border-ink ml-1.5 space-y-4 mt-4">
        {profile.timeline.map((t) => (
          <li key={t.attempt} className="pl-4 relative">
            <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-1.5 border-ink ${t.passed === t.total ? 'bg-pass' : 'bg-paper-card'}`} aria-hidden />
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold">Run {t.attempt}</span>
              <span className="text-sm text-ink-2">{t.passed} of {t.total} passed{t.qualityScore !== undefined && <> · Block quality {t.qualityScore}/100</>}</span>
            </div>
            <div className="text-sm space-y-0.5 mt-1">
              {t.added.map((a) => <div key={a}><span className="font-mono font-bold text-pass">+</span> {a}</div>)}
              {t.removed.map((a) => <div key={a}><span className="font-mono font-bold text-fail">−</span> {a}</div>)}
              {t.reordered && <div><span className="font-mono font-bold">↕</span> Changed the order</div>}
              {t.newlyFixed.length > 0 && <div className="text-pass font-bold">Now passing: {t.newlyFixed.join(', ')}</div>}
              {t.failed.length > 0 && <div className="text-ink-2">Still failing: {t.failed.join(', ')}</div>}
              {t.reflection && (
                <div className={`mt-1.5 rounded p-2 ${t.reflection.correct ? 'bg-pass-soft' : 'bg-partial-soft'}`}>
                  <span className="font-bold">Explained:</span> "{t.reflection.chosen}" {t.reflection.correct ? '(correct)' : `(it was actually: ${t.reflection.expected.toLowerCase()})`}
                  {t.reflection.text && <div className="italic mt-0.5">"{t.reflection.text}"</div>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
