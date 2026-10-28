/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { GraphMoleculeViewerSnapshot } from '../graph-workspace/GraphMoleculeViewerData';
import { LiveTrajectoryPlayer, type LiveTrajectoryPlayerProps } from './LiveTrajectoryPlayer';
import { liveStructureTrajectoryPath, type LiveStructureRow, type LiveTrajectoryFrame } from './liveStructures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});
setLocale('en', false);

const stream = { producer: 'pyscf/batch-7f3a', id: 'mol-0001' };
const frame = (seq: number): LiveTrajectoryFrame => ({ seq, format: 'xyz', xyz: `1\nstep ${seq}\nHe 0 0 ${seq}\n` });
const frames = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => frame(from + index));
const row = (status: LiveStructureRow['status'], summary: LiveStructureRow['summary'] = {}): LiveStructureRow =>
  ({ ...stream, status, seq: 1, summary: { stage: 'relax', step: 42, energy: -76.41, unit: 'Eh', ...summary } });
const sources: GraphMoleculeViewerSnapshot[] = [];
const viewer = (source: GraphMoleculeViewerSnapshot) => {
  sources.push(source);
  return <pre data-testid="viewer" data-frames={source.content.length}>{source.content.at(-1)}</pre>;
};
function player(props: Partial<LiveTrajectoryPlayerProps> = {}) {
  return <LiveTrajectoryPlayer stream={stream} row={row('running')} frames={frames(1, 3)} renderViewer={viewer} {...props} />;
}
const shownFrames = (element: HTMLElement) => Number(element.querySelector('[data-testid="viewer"]')?.getAttribute('data-frames'));

describe('liveStructureTrajectoryPath', () => {
  it('accepts workspace-relative trajectory paths only', () => {
    expect(liveStructureTrajectoryPath(row('done', { trajectory: 'runs/r1/molecules/mol-0001/trajectory.xyz' }))).toBe('runs/r1/molecules/mol-0001/trajectory.xyz');
    for (const trajectory of ['/etc/passwd', '../x.xyz', 'runs/../../x.xyz', 'C:\\x.xyz', 'https://example.com/x.xyz', '', 42, null]) {
      expect(liveStructureTrajectoryPath(row('done', { trajectory }))).toBeNull();
    }
    expect(liveStructureTrajectoryPath(null)).toBeNull();
  });
});

describe('LiveTrajectoryPlayer', () => {
  beforeEach(() => { sources.length = 0; });

  it('plays the received frames as one pre-split trajectory with a status header', () => {
    const element = render(player());
    expect(shownFrames(element)).toBe(3);
    const source = sources.at(-1)!;
    expect(source).toMatchObject({ format: 'xyz', framesSplit: true, uuid: JSON.stringify([stream.producer, stream.id]) });
    const head = element.querySelector('.live-trajectory-head')?.textContent ?? '';
    expect(head).toContain('mol-0001');
    expect(head).toContain('pyscf/batch-7f3a');
    expect(head).toContain('Running');
    expect(head).toContain('-76.41 Eh');
    expect(element.querySelector('.live-trajectory-meta')?.textContent).toContain('3 frames');
  });

  it('throttles growth to one viewer update per interval and keeps the stream identity', () => {
    const element = render(player());
    const before = sources.length;
    rerender(player({ frames: frames(1, 4) }));
    rerender(player({ frames: frames(1, 5) }));
    expect(shownFrames(element)).toBe(3);
    expect(element.querySelector('.live-trajectory-meta')?.textContent).toContain('3 frames');
    act(() => { vi.advanceTimersByTime(999); });
    expect(shownFrames(element)).toBe(3);
    act(() => { vi.advanceTimersByTime(1); });
    expect(shownFrames(element)).toBe(5);
    expect(element.querySelector('.live-trajectory-meta')?.textContent).toContain('5 frames · seq 1–5');
    expect(sources.length - before).toBeLessThanOrEqual(3);
    expect(new Set(sources.map(source => source.uuid)).size).toBe(1);
  });

  it('shows the first frames at once when none were shown yet', () => {
    const element = render(player({ frames: [], loading: true }));
    expect(element.querySelector('[data-testid="viewer"]')).toBeNull();
    expect(element.textContent).toContain('Loading frames');
    rerender(player({ frames: frames(1, 2) }));
    expect(shownFrames(element)).toBe(2);
  });

  it('says when earlier frames were not retained, and reports errors', () => {
    const element = render(player({ frames: frames(40, 41), truncated: true, error: 'Backfill failed' }));
    expect(element.querySelector('.live-trajectory-meta')?.textContent).toContain('Earlier frames were not kept');
    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Backfill failed');
  });

  it('keeps playing the held frames when the stream is done and never opens the file by itself', () => {
    const onOpenTrajectory = vi.fn();
    const path = 'runs/r1/molecules/mol-0001/trajectory.xyz';
    const element = render(player({ row: row('running', { trajectory: path }), onOpenTrajectory }));
    expect(element.querySelector('.live-trajectory-file')).toBeNull();
    rerender(player({ row: row('done', { trajectory: path }), onOpenTrajectory }));
    rerender(player({ row: row('done', { trajectory: path }), onOpenTrajectory, trajectoryAvailable: true }));
    expect(onOpenTrajectory).not.toHaveBeenCalled();
    expect(shownFrames(element)).toBe(3);
  });

  it('offers the trajectory file only once the host reports it in the workspace', () => {
    const onOpenTrajectory = vi.fn();
    const path = 'runs/r1/molecules/mol-0001/trajectory.xyz';
    const button = () => [...element.querySelectorAll('button')].find(value => value.textContent?.includes('Open trajectory file'));
    // Hosts may pass the handler only once the file exists; the hint shows either way.
    const element = render(player({ row: row('done', { trajectory: path }) }));
    expect(element.querySelector('.live-trajectory-file')?.textContent).toContain('available when the run syncs');
    expect(button()).toBeUndefined();
    rerender(player({ row: row('done', { trajectory: path }), onOpenTrajectory }));
    expect(element.querySelector('.live-trajectory-file')?.textContent).toContain('available when the run syncs');
    expect(button()).toBeUndefined();
    rerender(player({ row: row('done', { trajectory: path }), onOpenTrajectory, trajectoryAvailable: true }));
    expect(element.querySelector('.live-trajectory-file')?.textContent).toContain(path);
    expect(element.querySelector('.live-trajectory-file')?.textContent).not.toContain('available when the run syncs');
    button()!.click();
    expect(onOpenTrajectory).toHaveBeenCalledExactlyOnceWith(path);
  });

  it('offers no file for a failed stream', () => {
    const element = render(player({ row: row('failed', { trajectory: 'runs/r1/trajectory.xyz' }), onOpenTrajectory: vi.fn(), trajectoryAvailable: true }));
    expect(element.querySelector('.live-trajectory-file')).toBeNull();
  });

  it('closes through the host', () => {
    const onClose = vi.fn();
    const element = render(player({ onClose }));
    element.querySelector<HTMLButtonElement>('button[aria-label="Close trajectory mol-0001"]')!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
