import { useRef, type ReactNode } from 'react';
import introUrl from '../assets/assessment-intro.mp4';

export default function AssessmentIntro({ children, onContinue }: { children: ReactNode; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  function open() {
    const player = video.current!;
    dialog.current!.showModal();
    player.src = introUrl;
    // Start from the click so browsers can play with sound. Native controls also allow manual play.
    void player.play().catch(() => {});
    // Keep Skip in the fullscreen element. The dialog fills the viewport on inline-only browsers.
    void screen.current?.requestFullscreen?.().catch(() => {});
  }

  function finish() {
    if (!dialog.current?.open) return;
    video.current?.pause();
    if (document.fullscreenElement === screen.current) void document.exitFullscreen().catch(() => {});
    dialog.current.close();
    onContinue();
  }

  return <>
    <button type="button" className="btn bg-signal text-lg" data-testid="start-assessment" onClick={open}>{children}</button>
    <dialog ref={dialog} aria-label="Assessment introduction" className="assessment-intro"
      onCancel={event => { event.preventDefault(); finish(); }}>
      <div ref={screen} className="relative h-full w-full bg-black">
        <video ref={video} className="h-full w-full object-contain" aria-label="Assessment introduction video"
          playsInline controls controlsList="nofullscreen" preload="none" onEnded={finish} onError={finish} />
        <button type="button" className="btn bg-paper-card assessment-intro-skip" onClick={finish}>Skip video</button>
      </div>
    </dialog>
  </>;
}
