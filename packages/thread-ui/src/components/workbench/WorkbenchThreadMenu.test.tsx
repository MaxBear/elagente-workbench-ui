/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkbenchThreadMenu } from './WorkbenchThreadMenu';

// B04: the host draws a navigation rail left of the workbench. A menu opened
// from a narrow sidebar must stay inside the workbench, not slide under the rail.
type Box = { left: number; top: number; width: number; height: number };
const rect = ({ left, top, width, height }: Box) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

let root: Root | null = null;
let shell: HTMLDivElement | null = null;
const thread = { key: 't1', title: 'AIS session', subtitle: 'Grafico', href: '/chat?thread=t1', status: 'idle', favorite: false } as const;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  // Workbench starts after a 56px host rail; the trigger sits at the right of a 200px sidebar.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('thread-ui-shell')) return rect({ left: 56, top: 0, width: 1224, height: 800 });
    if (this.classList.contains('recent-thread-actions')) return rect({ left: 220, top: 100, width: 28, height: 28 });
    if (this.classList.contains('recent-thread-menu'))
      return rect({ left: parseFloat(this.style.left), top: parseFloat(this.style.top), width: 260, height: 220 });
    return rect({ left: 0, top: 0, width: 0, height: 0 });
  });
  shell = document.createElement('div');
  shell.className = 'thread-ui-shell';
  document.body.append(shell);
  const container = document.createElement('div');
  shell.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  shell?.remove();
  root = null;
  shell = null;
  vi.restoreAllMocks();
});

function menuBox() {
  const menu = document.querySelector<HTMLElement>('.recent-thread-menu')!;
  return { menu, left: parseFloat(menu.style.left), top: parseFloat(menu.style.top) };
}

describe('WorkbenchThreadMenu placement', () => {
  it('keeps a menu opened from a narrow sidebar inside the workbench, clear of the host rail', async () => {
    flushSync(() => root!.render(<WorkbenchThreadMenu thread={thread} copyIdLabel="Copy session ID" onNavigate={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />));
    await act(async () => document.querySelector<HTMLButtonElement>('.recent-thread-actions')!.click());
    const { menu, left, top } = menuBox();
    expect(menu.parentElement).toBe(shell);
    // Pockymoe's viewport clamp would put it at 8px, under the rail.
    expect(left).toBe(64);
    expect(top).toBe(134);
    expect(menu.textContent).toContain('Delete thread');
  });

  it('moves a right-click menu up and left so all of it is visible', async () => {
    const returnFocus = document.createElement('button');
    shell!.append(returnFocus);
    flushSync(() => root!.render(
      <WorkbenchThreadMenu thread={thread} context={{ x: 1250, y: 760, returnFocus, onClose: vi.fn() }} copyIdLabel="Copy session ID" onNavigate={vi.fn()} />,
    ));
    await act(async () => {});
    const { left, top } = menuBox();
    expect(left + 260).toBeLessThanOrEqual(1280 - 8);
    expect(top + 220).toBeLessThanOrEqual(800 - 8);
  });
});
