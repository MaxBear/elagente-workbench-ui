import { useCallback, useState } from 'react';

/** Passed to bottom-panel content so its title bar can own the panel actions. */
export interface WorkbenchToolPanelControls {
  maximized: boolean;
  collapsed: boolean;
  /** Phone-sized workbench: no hover, touch-sized targets, stacked splits. */
  compact: boolean;
  toggleMaximized: () => void;
  toggleCollapsed: () => void;
  close: () => void;
}

interface ToolPanelPreference {
  /** Null follows the default share of the available height. */
  height: number | null;
  maximized: boolean;
  collapsed: boolean;
}

const STORAGE_KEY = 'remote-codex.terminal-panel.v1';
const DEFAULT_PREFERENCE: ToolPanelPreference = { height: null, maximized: false, collapsed: false };

function readPreference(): ToolPanelPreference {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ToolPanelPreference> | null;
    if (!value || typeof value !== 'object') return DEFAULT_PREFERENCE;
    return {
      height: typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0 ? value.height : null,
      maximized: value.maximized === true,
      collapsed: value.collapsed === true,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Panel sizing rules: a usable terminal and a usable conversation, VS Code style. */
export function toolPanelBounds(columnHeight: number, compact: boolean) {
  const min = compact ? 160 : 120;
  const minConversation = compact ? 180 : 200;
  const max = Math.max(min, columnHeight - minConversation);
  // About 28% of the content height on desktop (layout plan §3.5), half on phones.
  const preferred = Math.round(columnHeight * (compact ? 0.48 : 0.28));
  return { min, max, preferred: Math.max(min, Math.min(max, preferred)) };
}

export function clampToolPanelHeight(height: number | null, columnHeight: number, compact: boolean) {
  const bounds = toolPanelBounds(columnHeight, compact);
  return Math.round(Math.max(bounds.min, Math.min(bounds.max, height ?? bounds.preferred)));
}

export function useWorkbenchToolPanel() {
  const [preference, setPreference] = useState(readPreference);
  /** Dragging updates every frame; persist once when the gesture ends. */
  const update = useCallback((patch: Partial<ToolPanelPreference>, persist = true) => {
    setPreference(current => {
      const next = { ...current, ...patch };
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional preference. */ }
      }
      return next;
    });
  }, []);
  return { ...preference, update };
}

export type WorkbenchToolPanelState = ReturnType<typeof useWorkbenchToolPanel>;
