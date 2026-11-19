import { useId } from 'react';
import { CONFIDENCE_LEVELS, type CurveballConfidenceLevel } from '../engine/curveball';

export default function CurveballConfidence({ value, onChange }: {
  value?: CurveballConfidenceLevel;
  onChange: (value: CurveballConfidenceLevel) => void;
}) {
  const name = useId();
  return <fieldset>
    <legend className="font-bold">How sure are you? <span className="text-sm font-normal">(optional, ungraded)</span></legend>
    <div className="mt-1 flex flex-wrap gap-2">{CONFIDENCE_LEVELS.map(level =>
      <label key={level} className={`inline-flex items-center gap-2 rounded border px-3 py-2 cursor-pointer ${value === level ? 'bg-signal-soft border-ink' : 'bg-paper-card border-line'}`}>
        <input type="radio" name={name} checked={value === level} onChange={() => onChange(level)} />{level}
      </label>)}</div>
  </fieldset>;
}
