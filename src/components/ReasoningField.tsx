import { Mic, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function speechService() {
  const browser = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

interface Props {
  label: ReactNode;
  value: string;
  change: (text: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}

export default function ReasoningField({ label, value, change, id, required, disabled, rows = 3 }: Props) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const active = useRef<Recognition | null>(null);
  const draft = useRef(value);
  const onChange = useRef(change);
  draft.current = value;
  onChange.current = change;
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const Service = speechService();

  useEffect(() => {
    setListening(false);
    return () => {
      const session = active.current;
      active.current = null;
      session?.abort();
    };
  }, [disabled]);

  function dictate() {
    if (active.current) {
      active.current.stop();
      return;
    }
    if (!Service || disabled) return;
    const session = new Service();
    active.current = session;
    session.lang = document.documentElement.lang === 'en' ? 'en-GB' : document.documentElement.lang || navigator.language;
    session.continuous = true;
    session.interimResults = false;
    let nextResult = 0;
    session.onresult = event => {
      if (active.current !== session) return;
      for (let i = Math.max(event.resultIndex, nextResult); i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        nextResult = i + 1;
        const words = result[0].transcript.trim();
        if (words) {
          draft.current = [draft.current.trimEnd(), words].filter(Boolean).join(' ');
          onChange.current(draft.current);
        }
      }
    };
    session.onerror = event => {
      if (active.current !== session) return;
      setMessage(event.error === 'not-allowed' ? 'Microphone access was denied. Allow it in browser settings to dictate.'
        : 'Dictation stopped. You can try again or type the rest.');
    };
    session.onend = () => {
      if (active.current !== session) return;
      active.current = null;
      setListening(false);
    };
    setMessage('');
    try {
      session.start();
      setListening(true);
    } catch {
      active.current = null;
      setMessage('The microphone could not start. Try again or type your answer.');
    }
  }

  return <div className="w-full space-y-1">
    <label htmlFor={fieldId} className="block font-bold">{label}</label>
    <textarea id={fieldId} data-testid={id} required={required} disabled={disabled} rows={rows} value={value}
      onChange={e => change(e.target.value)} className="block w-full rounded border-1.5 border-line bg-paper-card p-2 font-normal focus:border-ink" />
    {Service ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={dictate} disabled={disabled} aria-pressed={listening}
        className="inline-flex items-center gap-2 rounded border border-line bg-paper-card px-3 py-2 text-sm font-bold">
        {listening ? <Square size={15} /> : <Mic size={16} />} {listening ? 'Stop dictation' : 'Speak your reasoning'}
      </button>
      <small className="text-ink-2">Your browser may send audio to its speech service. Review the text before submitting.</small>
    </div> : <small className="text-ink-2">You can type or use dictation on your device’s keyboard.</small>}
    <p role="status" className="text-sm">{message || (listening ? 'Listening…' : '')}</p>
  </div>;
}
