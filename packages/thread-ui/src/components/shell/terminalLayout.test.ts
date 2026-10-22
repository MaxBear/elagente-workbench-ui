/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import {
  EMPTY_TERMINAL_LAYOUT,
  activeTerminalGroup,
  adjacentTerminal,
  loadTerminalLayout,
  reconcileTerminalLayout,
  removeTerminal,
  resizeTerminalPanes,
  saveTerminalLayout,
  splitTerminal,
} from './terminalLayout';

describe('terminal layout', () => {
  it('adopts every live shell as its own group and activates the newest', () => {
    expect(reconcileTerminalLayout(EMPTY_TERMINAL_LAYOUT, ['a', 'b'])).toEqual({
      groups: [{ shellIds: ['a'], sizes: [1] }, { shellIds: ['b'], sizes: [1] }],
      activeShellId: 'b',
      numbers: { a: 1, b: 2 },
    });
  });

  it('keeps default terminal numbers when another terminal closes', () => {
    const three = reconcileTerminalLayout(EMPTY_TERMINAL_LAYOUT, ['a', 'b', 'c']);
    const closed = removeTerminal(three, 'b');
    expect(closed.numbers).toEqual({ a: 1, c: 3 });
    expect(reconcileTerminalLayout(closed, ['a', 'c', 'd']).numbers).toEqual({ a: 1, c: 3, d: 4 });
  });

  it('splits beside the target, redistributes evenly and focuses the new pane', () => {
    const base = reconcileTerminalLayout(EMPTY_TERMINAL_LAYOUT, ['a', 'b']);
    const split = splitTerminal({ ...base, activeShellId: 'a' }, 'a', 'c');
    expect(split.groups[0]).toEqual({ shellIds: ['a', 'c'], sizes: [0.5, 0.5] });
    expect(split.activeShellId).toBe('c');
    expect(activeTerminalGroup(split)?.shellIds).toEqual(['a', 'c']);
    // The device lists the new shell too; reconciling must not duplicate it.
    expect(reconcileTerminalLayout(split, ['a', 'b', 'c']).groups.map(group => group.shellIds)).toEqual([['a', 'c'], ['b']]);
  });

  it('focuses a surviving split neighbour when the active terminal exits', () => {
    const layout = { groups: [{ shellIds: ['a', 'c', 'd'], sizes: [0.2, 0.5, 0.3] }, { shellIds: ['b'], sizes: [1] }], activeShellId: 'c' };
    const next = removeTerminal(layout, 'c');
    expect(next.groups[0]).toEqual({ shellIds: ['a', 'd'], sizes: [0.4, 0.6] });
    expect(next.numbers).toEqual({ a: 1, d: 2, b: 3 });
    expect(next.activeShellId).toBe('a');
  });

  it('cycles panes inside the visible group only', () => {
    const layout = { groups: [{ shellIds: ['a', 'c'], sizes: [0.5, 0.5] }, { shellIds: ['b'], sizes: [1] }], activeShellId: 'c' };
    expect(adjacentTerminal(layout, 1)).toBe('a');
    expect(adjacentTerminal(layout, -1)).toBe('a');
    expect(adjacentTerminal({ ...layout, activeShellId: 'b' }, 1)).toBeNull();
  });

  it('keeps both panes at least 80px while dragging a split boundary', () => {
    expect(resizeTerminalPanes([0.5, 0.5], 0, 100, 1000)).toEqual([0.6, 0.4]);
    expect(resizeTerminalPanes([0.5, 0.5], 0, -900, 1000)).toEqual([0.08, 0.92]);
    expect(resizeTerminalPanes([0.5, 0.5], 0, 900, 1000)[1]).toBeCloseTo(0.08);
  });

  it('round-trips the preference and ignores corrupt storage', () => {
    const layout = { groups: [{ shellIds: ['a', 'b'], sizes: [0.3, 0.7] }], activeShellId: 'b' };
    saveTerminalLayout('terminal-layout-test', layout);
    expect(loadTerminalLayout('terminal-layout-test')).toEqual(layout);
    localStorage.setItem('terminal-layout-test', '{"groups":3}');
    expect(loadTerminalLayout('terminal-layout-test')).toEqual(EMPTY_TERMINAL_LAYOUT);
  });
});
