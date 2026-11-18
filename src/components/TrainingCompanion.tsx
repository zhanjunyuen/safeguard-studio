/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import { BLOCKS } from '../data/blocks';
import type { ScriptBlock } from '../types';
import type { Cargo } from './companionModel';
import './TrainingCompanion.css';

const companions = {
  community: { role: 'School community helper', color: '#83aaa9', cargo: 'tablet', greeting: 'Hello! Who are we helping at school today?' },
  history: { role: 'Archive assistant', color: '#899bb1', cargo: 'books', greeting: 'Shall we open the history books?' },
  party: { role: 'Party planner', color: '#c19a96', cargo: 'parcel', greeting: 'Who’s coming to our class party?' },
  news: { role: 'Newsroom assistant', color: '#96aa96', cargo: 'paper', greeting: 'Got a story for our next edition?' },
  quiz: { role: 'Revision buddy', color: '#b1a2bc', cargo: 'cards', greeting: 'Which topic are we revising today?' },
  chat: { role: 'Chat helper', color: '#83aaa9', cargo: 'tablet', greeting: 'What’s happening in the class chat?' },
  options: { role: 'Options guide', color: '#c2ac8c', cargo: 'guide', greeting: 'Which subjects catch your eye?' },
} satisfies Record<string, { role: string; color: string; cargo: Cargo; greeting: string }>;

const REST_SECONDS = 30;
const WALK_DISTANCE_PX = 64;
const HANDOFF_SECONDS = 2.2;

type Reaction = { kind: 'hello' | 'learn'; text: string; started: number };
const portraits = import.meta.glob<string>('../assets/companions/*.webp', { eager: true, query: '?url', import: 'default' });

export default function TrainingCompanion({ id, script }: { id: string; script: ScriptBlock[] }) {
  const { role, color, cargo, greeting } = companions[id as keyof typeof companions] ?? companions.history;
  const previous = useRef(script);
  const track = useRef<HTMLDivElement>(null);
  const actor = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointed = useRef(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionRef = useRef(reaction);
  useEffect(() => { reactionRef.current = reaction; }, [reaction]);
  useEffect(() => {
    const before = previous.current;
    previous.current = script;
    if (script.length <= before.length) return;
    const added = script.find(b => !before.some(old => old.uid === b.uid));
    if (added) setReaction({ kind: 'learn', text: 'Added “' + BLOCKS[added.type].label + '” to my steps.', started: performance.now() });
  }, [script]);
  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(null), 4000);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  useEffect(() => {
    const lane = track.current!;
    const button = actor.current!;
    const surface = canvas.current!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let model: ReturnType<typeof import('./companionModel').makeCompanion> | undefined;
    let disposed = false;
    import('./companionModel').then(({ makeCompanion }) => {
      if (disposed) return;
      model = makeCompanion(surface, color, cargo);
      button.dataset.model = 'ready';
    }).catch(() => { /* The prerendered portrait remains available without WebGL. */ });

    const lostContext = () => { delete button.dataset.model; };
    surface.addEventListener('webglcontextlost', lostContext);
    const restoredContext = () => { button.dataset.model = 'ready'; staticDrawn = false; };
    surface.addEventListener('webglcontextrestored', restoredContext);
    let staticDrawn = false;
    let width = 0;
    const resize = new ResizeObserver(() => { width = Math.min(WALK_DISTANCE_PX, Math.max(0, lane.clientWidth - button.offsetWidth)); });
    resize.observe(lane);
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(lane);
    let frame = 0, last = 0, elapsed = 0, position = 0, heading = .36, direction = 1;
    let rest = REST_SECONDS, carrying = true, handoff = false, stride = 0, gait = 0;
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (now - last < 32) return;
      const dt = Math.min((now - last) / 1000, .07);
      last = now;
      if (!visible || document.hidden) return;
      const reduced = motion.matches;
      if (reduced && staticDrawn) return;
      staticDrawn = reduced && !!model;
      const active = reactionRef.current;
      const attentive = !!active || pointed.current || button.matches(':focus-visible');
      elapsed += dt;
      position = Math.min(width, position);
      const walking = !reduced && !attentive && rest <= 0 && width > 0;
      let reach = 0;
      if (walking) {
        const next = position + direction * dt * 30;
        position = Math.max(0, Math.min(width, next));
        if (next >= width || next <= 0) {
          handoff = next <= 0;
          direction *= -1;
          rest = REST_SECONDS;
        }
      } else if (!reduced && !attentive && rest > 0) {
        const before = REST_SECONDS - rest;
        rest -= dt;
        if (handoff) {
          const progress = Math.min(1, (REST_SECONDS - rest) / HANDOFF_SECONDS);
          reach = Math.sin(Math.PI * progress);
          if (before < HANDOFF_SECONDS / 2 && progress >= .5) carrying = !carrying;
          if (progress === 1) handoff = false;
        }
      }
      gait += ((walking ? 1 : 0) - gait) * .24;
      stride += dt * 8 * gait;
      heading += ((walking ? -direction * .69 : .13) - heading) * .09;
      const age = active ? (now - active.started) / 1000 : 0;
      const beat = active && age < 1.6 ? Math.sin(Math.PI * age / 1.6) : 0;
      button.style.transform = 'translateX(' + (reduced ? 0 : -position) + 'px)';
      lane.dataset.carrying = String(carrying);
      model?.draw({
        time: reduced ? 0 : elapsed, walking: reduced ? 0 : gait, turn: reduced ? .25 : heading, stride,
        wave: !reduced && active?.kind === 'hello' && !carrying ? beat * (.91 + .09 * Math.cos(age * 19)) : 0,
        nod: !reduced && active ? beat * (1 - Math.cos(age * 9)) : 0,
        reach: reduced ? 0 : reach, carrying,
      });
    }
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      surface.removeEventListener('webglcontextlost', lostContext);
      surface.removeEventListener('webglcontextrestored', restoredContext);
      model?.dispose();
    };
  }, [color, cargo]);

  return (
    <div className="companion-ledge" ref={track}>
      <div className="companion-shelf" aria-hidden="true" />
      <span aria-hidden="true" className={'companion-cargo cargo-' + cargo}><i /></span>
      <span className="companion-note" role="status">{reaction?.text}</span>
      <button ref={actor} type="button" className={'companion-actor' + (reaction ? ' reacting' : '')}
        aria-label={'Say hello to your ' + role.toLowerCase()} title={role + ' · Say hello'}
        onPointerEnter={e => { pointed.current = e.pointerType === 'mouse'; }}
        onPointerLeave={() => { pointed.current = false; }}
        onClick={() => setReaction({ kind: 'hello', text: greeting, started: performance.now() })}>
        <img src={portraits['../assets/companions/' + (id === 'community' ? 'chat' : id) + '.webp']} alt="" aria-hidden="true" />
        <canvas ref={canvas} aria-hidden="true" />
      </button>
    </div>
  );
}
