/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpPanelMode, SettingsMenu, SlashPanelView } from './types';
import {
  useComposerMenuLifecycle,
  type UseComposerMenuLifecycleInput,
  type UseComposerMenuLifecycleResult,
} from './useComposerMenuLifecycle';

let latestResult: UseComposerMenuLifecycleResult | null = null;

function HookHarness(props: UseComposerMenuLifecycleInput) {
  latestResult = useComposerMenuLifecycle(props);
  return null;
}

function renderHookHarness(
  input: Partial<UseComposerMenuLifecycleInput> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let openMenu: SettingsMenu = input.openMenu ?? 'slash';
  let slashPanelView: SlashPanelView = input.slashPanelView ?? 'root';
  let mcpPanelMode: McpPanelMode = 'list';
  const clearMcpConfigStatus = input.clearMcpConfigStatus ?? vi.fn();
  const clearHookConfigStatus = input.clearHookConfigStatus ?? vi.fn();
  const setOpenMenu = vi.fn((next: SettingsMenu | ((value: SettingsMenu) => SettingsMenu)) => {
    openMenu = typeof next === 'function' ? next(openMenu) : next;
  });
  const setSlashPanelView = vi.fn(
    (next: SlashPanelView | ((value: SlashPanelView) => SlashPanelView)) => {
      slashPanelView =
        typeof next === 'function' ? next(slashPanelView) : next;
    },
  );
  const setMcpPanelMode = vi.fn(
    (next: McpPanelMode | ((value: McpPanelMode) => McpPanelMode)) => {
      mcpPanelMode =
        typeof next === 'function' ? next(mcpPanelMode) : next;
    },
  );

  function render() {
    flushSync(() => {
      root.render(
        <HookHarness
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          slashPanelView={slashPanelView}
          setSlashPanelView={setSlashPanelView}
          setMcpPanelMode={setMcpPanelMode}
          clearMcpConfigStatus={clearMcpConfigStatus}
          clearHookConfigStatus={clearHookConfigStatus}
        />,
      );
    });
  }

  render();

  return {
    get openMenu() {
      return openMenu;
    },
    get slashPanelView() {
      return slashPanelView;
    },
    get mcpPanelMode() {
      return mcpPanelMode;
    },
    setOpenMenu,
    setSlashPanelView,
    setMcpPanelMode,
    clearMcpConfigStatus,
    clearHookConfigStatus,
    rerender(nextInput: Partial<UseComposerMenuLifecycleInput> = {}) {
      if ('openMenu' in nextInput) {
        openMenu = nextInput.openMenu ?? null;
      }
      if (nextInput.slashPanelView) {
        slashPanelView = nextInput.slashPanelView;
      }
      render();
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects() {
  await Promise.resolve();
  flushSync(() => {});
}

describe('useComposerMenuLifecycle', () => {
  beforeEach(() => {
    latestResult = null;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestResult = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resets slash subpanels when the slash menu closes', async () => {
    const harness = renderHookHarness({
      openMenu: 'slash',
      slashPanelView: 'mcp',
    });

    harness.rerender({ openMenu: null });
    await flushEffects();

    expect(harness.setSlashPanelView).toHaveBeenCalledWith('root');
    expect(harness.setMcpPanelMode).toHaveBeenCalledWith('list');
    expect(harness.clearMcpConfigStatus).toHaveBeenCalled();
    expect(harness.clearHookConfigStatus).toHaveBeenCalled();
    harness.unmount();
  });

  it('clears MCP config status when leaving the MCP subpanel', async () => {
    const harness = renderHookHarness({
      openMenu: 'slash',
      slashPanelView: 'mcp',
    });
    vi.mocked(harness.clearMcpConfigStatus).mockClear();

    harness.rerender({ slashPanelView: 'skills' });
    await flushEffects();

    expect(harness.setMcpPanelMode).toHaveBeenCalledWith('list');
    expect(harness.clearMcpConfigStatus).toHaveBeenCalledTimes(1);
    harness.unmount();
  });

  it('copies a skill invoke name and clears the copied state after a delay', async () => {
    vi.useFakeTimers();
    const harness = renderHookHarness();

    await latestResult?.copySkillInvokeName('reviewer');
    harness.rerender();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('$reviewer');
    expect(latestResult?.copiedSkillName).toBe('reviewer');

    flushSync(() => {
      vi.advanceTimersByTime(1400);
    });
    harness.rerender();

    expect(latestResult?.copiedSkillName).toBeNull();
    harness.unmount();
  });

  it('closes open menus on outside pointerdown but keeps menu-surface clicks', async () => {
    const harness = renderHookHarness({ openMenu: 'attachments' });
    const menuSurface = document.createElement('button');
    menuSurface.dataset.composerMenuSurface = 'true';
    document.body.appendChild(menuSurface);

    menuSurface.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, composed: true }),
    );
    await flushEffects();
    expect(harness.setOpenMenu).not.toHaveBeenCalledWith(null);

    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, composed: true }),
    );
    await flushEffects();

    expect(harness.setOpenMenu).toHaveBeenCalledWith(null);
    menuSurface.remove();
    harness.unmount();
  });
  it('returns keyboard focus to the owning composer trigger before Escape closes a menu', () => {
    const harness = renderHookHarness();
    const controls = document.createElement('div');
    controls.innerHTML = '<button data-composer-menu-trigger="true">Slash</button><div data-composer-menu-surface="true"><button>Menu action</button></div>';
    document.body.append(controls);
    controls.querySelector<HTMLButtonElement>('[data-composer-menu-surface] button')!.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(controls.querySelector('[data-composer-menu-trigger]'));
    expect(harness.setOpenMenu).toHaveBeenCalledWith(null);
    controls.remove();
    harness.unmount();
  });

});
