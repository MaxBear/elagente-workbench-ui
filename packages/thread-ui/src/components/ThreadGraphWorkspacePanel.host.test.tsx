// @vitest-environment jsdom
import type { ThreadDetailDto } from '@remote-codex/shared';
import { act, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { createDefaultPluginContextValue } from '../plugins/plugin-context';
import { ThreadGraphWorkspacePanel, type ThreadGraphWorkspacePanelProps, type WorkspaceHostPanel } from './ThreadGraphWorkspacePanel';

vi.mock('./graph-workspace/GraphWorkspaceExplorer', () => ({
  GraphWorkspaceExplorer: ({ focusPathRequest }: { focusPathRequest?: { path: string } | null }) =>
    <div data-testid="explorer">{focusPathRequest?.path ?? 'files'}</div>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
setLocale('en', false);
let root: Root | null = null;
let container: HTMLDivElement | null = null;
function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}
const rerender = (node: ReactNode) => act(() => root?.render(node));
afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const detail = { thread: { id: 'thread-1' }, workspace: { absPath: '/w' }, turns: [] } as unknown as ThreadDetailDto;
const plugins = createDefaultPluginContextValue();
const features = { workspace: true, toolUsage: true, guide: false, threadGraph: false, extensions: false };
function panel(props: Partial<ThreadGraphWorkspacePanelProps> = {}) {
  return <ThreadGraphWorkspacePanel detail={detail} status={null} plugins={plugins} features={features} {...props} />;
}
const player = (onClose = vi.fn()): WorkspaceHostPanel => ({
  id: 'trajectory:mol-0001', label: 'mol-0001', title: 'Trajectory of mol-0001',
  content: <div data-testid="player">frames</div>, onClose,
});
const visible = (element: HTMLElement, id: string) => {
  const node = element.querySelector(`[data-testid="${id}"]`);
  return Boolean(node && !node.closest('[hidden]'));
};

describe('ThreadGraphWorkspacePanel host panels', () => {
  it('shows host panels as closable tabs and opens the requested one', () => {
    const onClose = vi.fn();
    const element = render(panel({ hostPanels: [player(onClose)] }));
    expect(visible(element, 'explorer')).toBe(true);
    expect(visible(element, 'player')).toBe(false);
    rerender(panel({ hostPanels: [player(onClose)], hostPanelRequest: { id: 'trajectory:mol-0001', requestId: 1 } }));
    expect(visible(element, 'player')).toBe(true);
    // The Explorer stays mounted (its open files are kept) while hidden.
    expect(element.querySelector('[data-testid="explorer"]')).not.toBeNull();
    expect(visible(element, 'explorer')).toBe(false);
    const tab = element.querySelector<HTMLButtonElement>('button[title="Trajectory of mol-0001"]')!;
    expect(tab.className).toContain('is-active');
    act(() => element.querySelector<HTMLButtonElement>('button[aria-label="Close mol-0001"]')!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns to the files when a file is focused, and back to the panel on a new request', () => {
    const element = render(panel({ hostPanels: [player()], hostPanelRequest: { id: 'trajectory:mol-0001', requestId: 1 } }));
    rerender(panel({ hostPanels: [player()], hostPanelRequest: { id: 'trajectory:mol-0001', requestId: 1 }, focusPathRequest: { path: 'runs/t.xyz', requestId: 1 } }));
    expect(visible(element, 'explorer')).toBe(true);
    expect(element.querySelector('[data-testid="explorer"]')?.textContent).toBe('runs/t.xyz');
    expect(visible(element, 'player')).toBe(false);
    act(() => element.querySelector<HTMLButtonElement>('button[title="Trajectory of mol-0001"]')!.click());
    expect(visible(element, 'player')).toBe(true);
    flushSync(() => [...element.querySelectorAll<HTMLButtonElement>('.thread-graph-right-tab')].find(button => button.textContent === 'Workspace')!.click());
    expect(visible(element, 'explorer')).toBe(true);
  });

  it('falls back to the files when the open panel is removed', () => {
    const element = render(panel({ hostPanels: [player()], hostPanelRequest: { id: 'trajectory:mol-0001', requestId: 1 } }));
    rerender(panel({ hostPanels: [], hostPanelRequest: { id: 'trajectory:mol-0001', requestId: 1 } }));
    expect(visible(element, 'explorer')).toBe(true);
    expect(element.querySelector('.thread-graph-right-tabs')).toBeNull();
  });
});
