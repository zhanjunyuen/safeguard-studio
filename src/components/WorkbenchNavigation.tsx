export type WorkbenchPanel = 'palette' | 'helper' | 'results';
const panels: WorkbenchPanel[] = ['palette', 'helper', 'results'];

export default function WorkbenchNavigation({ mode, selected, onSelect, resultsLabel = 'Results' }: {
  mode: 'build' | 'break';
  resultsLabel?: string;
  selected?: WorkbenchPanel;
  onSelect?: (panel: WorkbenchPanel) => void;
}) {
  const labels = mode === 'build' ? ['Blocks', 'Your helper', selected ? 'Tests & notes' : 'Tests'] : ['Attacks', 'Attack plan', resultsLabel];
  return <nav aria-label="Workbench sections" className="workbench-nav">
    {panels.map((panel, i) => <button className="btn bg-paper-card text-sm" key={panel} type="button"
      aria-pressed={onSelect ? selected === panel : undefined} aria-controls={'workbench-' + panel} onClick={() => {
        if (onSelect) { onSelect(panel); return; }
        const target = document.getElementById('workbench-' + panel);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: 'start' });
      }}>{labels[i]}</button>)}
  </nav>;
}
