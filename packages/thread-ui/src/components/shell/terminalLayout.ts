/**
 * Terminal groups follow VS Code: each tab-list entry is one terminal, a split
 * adds a terminal to the active group, and one group is visible at a time.
 * Shells live on the device; grouping is a browser preference per thread.
 */
export interface TerminalGroup {
  shellIds: string[];
  /** Fractions of the group's width (or height), summing to 1. */
  sizes: number[];
}

export interface TerminalLayout {
  groups: TerminalGroup[];
  activeShellId: string | null;
  /** Default names ("Terminal 3") stay put when other terminals close. */
  numbers?: Record<string, number>;
}

export const EMPTY_TERMINAL_LAYOUT: TerminalLayout = { groups: [], activeShellId: null };
/** VS Code's SplitPaneMinSize. */
export const TERMINAL_PANE_MIN_SIZE = 80;
export const TERMINAL_GROUP_MAX_PANES = 4;

const evenSizes = (count: number) => Array.from({ length: count }, () => 1 / count);

function normalizeSizes(sizes: number[], count: number) {
  if (sizes.length !== count || sizes.some(size => !Number.isFinite(size) || size <= 0)) return evenSizes(count);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return sizes.map(size => size / total);
}

/** Drop exited shells, adopt shells created elsewhere and keep a valid active terminal. */
export function reconcileTerminalLayout(layout: TerminalLayout, liveShellIds: string[]): TerminalLayout {
  const live = new Set(liveShellIds);
  const placed = new Set<string>();
  const groups: TerminalGroup[] = [];
  for (const group of layout.groups) {
    const kept = group.shellIds.flatMap((id, index) => (live.has(id) && !placed.has(id) ? [[id, group.sizes[index] ?? 0] as const] : []));
    if (!kept.length) continue;
    kept.forEach(([id]) => placed.add(id));
    groups.push({ shellIds: kept.map(([id]) => id), sizes: normalizeSizes(kept.map(([, size]) => size), kept.length) });
  }
  for (const id of liveShellIds) {
    if (!placed.has(id)) groups.push({ shellIds: [id], sizes: [1] });
  }
  let activeShellId = layout.activeShellId && live.has(layout.activeShellId) ? layout.activeShellId : null;
  if (!activeShellId && layout.activeShellId) {
    // Like closing a split pane: focus a neighbour in the same group first.
    const previousGroup = layout.groups.find(group => group.shellIds.includes(layout.activeShellId!));
    activeShellId = previousGroup?.shellIds.find(id => live.has(id)) ?? null;
  }
  activeShellId ??= groups.at(-1)?.shellIds[0] ?? null;
  const numbers: Record<string, number> = {};
  for (const id of liveShellIds) {
    const number = layout.numbers?.[id];
    if (Number.isInteger(number) && number! > 0) numbers[id] = number!;
  }
  let next = Math.max(0, ...Object.values(numbers));
  for (const id of liveShellIds) numbers[id] ??= ++next;
  return { groups, activeShellId, numbers };
}

export function activeTerminalGroup(layout: TerminalLayout) {
  return layout.groups.find(group => layout.activeShellId && group.shellIds.includes(layout.activeShellId)) ?? layout.groups[0] ?? null;
}

/** Add a new terminal beside the target, evenly redistributing the group. */
export function splitTerminal(layout: TerminalLayout, targetShellId: string, newShellId: string): TerminalLayout {
  const groups = layout.groups.map(group => {
    const index = group.shellIds.indexOf(targetShellId);
    if (index < 0) return group;
    const shellIds = [...group.shellIds.slice(0, index + 1), newShellId, ...group.shellIds.slice(index + 1)];
    return { shellIds, sizes: evenSizes(shellIds.length) };
  });
  return { ...layout, groups, activeShellId: newShellId };
}

export function addTerminalGroup(layout: TerminalLayout, shellId: string): TerminalLayout {
  return { ...layout, groups: [...layout.groups.filter(group => !group.shellIds.includes(shellId)), { shellIds: [shellId], sizes: [1] }], activeShellId: shellId };
}

export function removeTerminal(layout: TerminalLayout, shellId: string): TerminalLayout {
  return reconcileTerminalLayout(layout, layout.groups.flatMap(group => group.shellIds).filter(id => id !== shellId));
}

/** Previous/next pane in the visible group, wrapping like VS Code. */
export function adjacentTerminal(layout: TerminalLayout, direction: -1 | 1) {
  const group = activeTerminalGroup(layout);
  if (!group || group.shellIds.length < 2 || !layout.activeShellId) return null;
  const index = group.shellIds.indexOf(layout.activeShellId);
  return group.shellIds[(index + direction + group.shellIds.length) % group.shellIds.length] ?? null;
}

/** Move the boundary after `index` by `delta` pixels, keeping both panes usable. */
export function resizeTerminalPanes(sizes: number[], index: number, delta: number, total: number) {
  if (index < 0 || index >= sizes.length - 1 || total <= 0) return sizes;
  const min = Math.min(TERMINAL_PANE_MIN_SIZE / total, 0.5);
  const pair = sizes[index]! + sizes[index + 1]!;
  const first = Math.max(min, Math.min(pair - min, sizes[index]! + delta / total));
  const next = [...sizes];
  next[index] = first;
  next[index + 1] = pair - first;
  return next;
}

function isLayout(value: unknown): value is TerminalLayout {
  const layout = value as TerminalLayout | null;
  return Boolean(layout && Array.isArray(layout.groups) && layout.groups.every(group =>
    Array.isArray(group?.shellIds) && group.shellIds.every(id => typeof id === 'string') && Array.isArray(group.sizes)));
}

export function loadTerminalLayout(key: string | undefined): TerminalLayout {
  if (!key) return EMPTY_TERMINAL_LAYOUT;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (isLayout(parsed)) return {
      groups: parsed.groups,
      activeShellId: typeof parsed.activeShellId === 'string' ? parsed.activeShellId : null,
      ...(parsed.numbers && typeof parsed.numbers === 'object' ? { numbers: parsed.numbers } : {}),
    };
  } catch { /* A corrupt preference falls back to one group per terminal. */ }
  return EMPTY_TERMINAL_LAYOUT;
}

export function saveTerminalLayout(key: string | undefined, layout: TerminalLayout) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* Optional preference. */ }
}
