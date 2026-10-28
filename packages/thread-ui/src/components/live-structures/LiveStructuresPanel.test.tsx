/**
 * @vitest-environment jsdom
 */
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { LiveStructuresPanel, type LiveStructuresPanelProps } from './LiveStructuresPanel';
import type { LiveStructureFrame, LiveStructureKey, LiveStructureRow } from './liveStructures';

let root: Root | null = null;
let container: HTMLDivElement | null = null;
function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root?.render(node));
  return container;
}
function rerender(node: ReactNode) {
  flushSync(() => root?.render(node));
}
afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});
setLocale('en', false);

const rows: LiveStructureRow[] = Array.from({ length: 250 }, (_, index) => ({
  producer: 'pyscf/batch-7f3a',
  id: `mol-${String(index + 1).padStart(4, '0')}`,
  seq: index + 1,
  status: index === 1 ? 'failed' : index === 2 ? 'done' : 'running',
  summary: { stage: 'relax', step: index, energy: -76.41 - index / 100, unit: 'Eh', label: 'H2O' },
}));
const totals = { streams: 250, running: 248, done: 1, failed: 1 };
const frame = (id: string, xyz = '1\nstep\nHe 0 0 0\n'): LiveStructureFrame => ({ producer: 'pyscf/batch-7f3a', id, format: 'xyz', xyz });
const viewer = (value: LiveStructureFrame) => <pre data-testid="viewer" data-stream={value.id}>{value.xyz}</pre>;

function panel(props: Partial<LiveStructuresPanelProps> = {}) {
  return (
    <LiveStructuresPanel totals={totals} producers={[{ id: 'pyscf/batch-7f3a', streams: 250 }]} rows={rows}
      selected={[]} onSelectionChange={() => {}} renderViewer={viewer} {...props} />
  );
}

describe('LiveStructuresPanel', () => {
  it('shows totals, producers and a page of summaries with derived columns', () => {
    const element = render(panel());
    expect(element.querySelector('.live-structures-totals')?.textContent).toContain('250 streams');
    expect(element.querySelector('.live-structures-totals')?.textContent).toContain('1 failed');
    expect(element.querySelector('.live-structures-producers')?.textContent).toContain('pyscf/batch-7f3a');
    const headers = [...element.querySelectorAll('thead th')].map(cell => cell.textContent);
    expect(headers).toEqual(['Watch', 'ID', 'Label', 'Stage', 'Step', 'Energy', 'Status']);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(100);
    expect(element.querySelector('tbody tr td:nth-child(6)')?.textContent).toBe(`${(-76.41).toLocaleString()} Eh`);
    expect(element.querySelector('.live-structures-pager')?.textContent).toContain('Page 1 of 3');
    expect(element.querySelector('caption')?.textContent).toBe('Live structure summaries, page 1 of 3');
  });

  it('pages locally when the host does not page', () => {
    const element = render(panel());
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click());
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click());
    expect(element.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(element.querySelector('tbody tr td:nth-child(2)')?.textContent).toBe('mol-0201');
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.disabled).toBe(true);
  });

  it('asks the host for pages and filters when it pages', () => {
    const onPageChange = vi.fn(), onStatusFilterChange = vi.fn();
    const element = render(panel({ rows: rows.slice(0, 100), page: 0, rowCount: 12_000, onPageChange, onStatusFilterChange }));
    expect(element.querySelector('.live-structures-pager')?.textContent).toContain('Page 1 of 120');
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click());
    expect(onPageChange).toHaveBeenCalledWith(1);
    const failed = [...element.querySelectorAll<HTMLButtonElement>('.live-structures-total')].find(button => button.textContent === '1 failed')!;
    expect(failed.getAttribute('aria-pressed')).toBe('false');
    flushSync(() => failed.click());
    expect(onStatusFilterChange).toHaveBeenCalledWith('failed');
  });

  it('selects up to four streams and disables further rows', () => {
    let selected: LiveStructureKey[] = [];
    function Harness() {
      const [value, setValue] = useState<LiveStructureKey[]>([]);
      return panel({ selected: value, onSelectionChange: next => { selected = next; setValue(next); } });
    }
    const element = render(<Harness />);
    const boxes = () => [...element.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')];
    for (const index of [0, 1, 2]) flushSync(() => boxes()[index]!.click());
    // A row click toggles like its checkbox.
    flushSync(() => element.querySelectorAll<HTMLTableRowElement>('tbody tr')[3]!.click());
    expect(selected.map(value => value.id)).toEqual(['mol-0001', 'mol-0002', 'mol-0003', 'mol-0004']);
    expect(boxes()[4]!.disabled).toBe(true);
    expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain('maximum of 4');
    expect(element.querySelectorAll('tbody tr[aria-selected="true"]')).toHaveLength(4);
    expect(boxes()[0]!.getAttribute('aria-label')).toBe('Watch mol-0001');
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label="Stop watching mol-0002"]')!.click());
    expect(selected.map(value => value.id)).toEqual(['mol-0001', 'mol-0003', 'mol-0004']);
  });

  it('shows the latest inline frame of each watched stream and keeps the viewer mounted across frames', () => {
    const selected = [{ producer: 'pyscf/batch-7f3a', id: 'mol-0001' }, { producer: 'pyscf/batch-7f3a', id: 'mol-0002' }];
    const element = render(panel({ selected, frames: [frame('mol-0001'), frame('mol-0999')] }));
    const viewers = [...element.querySelectorAll('[data-testid="viewer"]')];
    expect(viewers.map(node => node.getAttribute('data-stream'))).toEqual(['mol-0001']);
    expect(element.querySelector('figure[data-stream="mol-0002"]')?.textContent).toContain('Waiting for the next frame');
    expect(element.querySelector('figure[data-stream="mol-0002"]')?.textContent).toContain('Failed');
    const mounted = viewers[0];
    rerender(panel({ selected, frames: [frame('mol-0001', '1\nstep 2\nHe 0 0 1\n')] }));
    const next = element.querySelector('[data-testid="viewer"]');
    expect(next).toBe(mounted);
    expect(next?.textContent).toContain('He 0 0 1');
  });

  it('collapses with an accessible toggle and reports empty and ended states', () => {
    const element = render(panel({ totals: { streams: 0, running: 0, done: 0, failed: 0 }, rows: [], producers: [] }));
    expect(element.textContent).toContain('No live structures have been reported yet.');
    const toggle = element.querySelector<HTMLButtonElement>('.live-structures-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    flushSync(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
    rerender(panel({ ended: true }));
    expect(element.querySelector('.live-structures')?.getAttribute('data-ended')).toBe('true');
    expect(element.querySelector('.live-structures-head')?.textContent).toContain('Ended');
  });
});
