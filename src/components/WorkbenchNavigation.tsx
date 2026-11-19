export default function WorkbenchNavigation({ mode }: { mode: 'build' | 'break' }) {
  const labels = mode === 'build' ? ['Blocks', 'Your helper', 'Tests'] : ['Attacks', 'Attack plan', 'Results'];
  const panels = ['workbench-palette', 'workbench-helper', 'workbench-results'];
  return <nav aria-label="Workbench sections" className="workbench-nav">
    {labels.map((label, i) => <button key={label} type="button" onClick={() => {
      const panel = document.getElementById(panels[i]);
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start' });
    }}>{label}</button>)}
  </nav>;
}
