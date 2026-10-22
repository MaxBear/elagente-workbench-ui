import { describe, expect, it } from 'vitest';

import type { ShellSessionDto, ThreadShellStateDto } from '@remote-codex/shared';
import {
  EMPTY_SHELL_PANE_RUNTIME_STATE,
  buildConnectionButtonState,
  buildShellControlState,
  isLiveShell,
  runtimeStatesEqual,
  selectInitialActiveShell,
  shellCanAttach,
  type ShellPaneRuntimeState,
} from './shellState';

function shell(
  id: string,
  status: ShellSessionDto['status'] = 'running',
  extra: Partial<ShellSessionDto> = {},
): ShellSessionDto {
  return {
    id,
    threadId: 'thread-1',
    workspaceId: 'workspace-1',
    status,
    backend: 'pty',
    cwd: `/repo/${id}`,
    tmuxSessionName: `tmux-${id}`,
    label: null,
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    lastActivityAt: null,
    attachedViewerId: null,
    ...extra,
  };
}

function shellState(
  shells: ShellSessionDto[],
  extra: Partial<ThreadShellStateDto> = {},
): ThreadShellStateDto {
  return {
    threadId: 'thread-1',
    workspaceId: 'workspace-1',
    state: shells[0]?.status ?? 'not_created',
    shell: shells[0] ?? null,
    shells,
    activeShellId: shells[0]?.id ?? null,
    workspacePathStatus: 'present',
    ...extra,
  };
}

describe('shell state helpers', () => {
  it('detects live and attachable shells', () => {
    expect(isLiveShell(shell('running'))).toBe(true);
    expect(isLiveShell(shell('exited', 'exited'))).toBe(false);
    expect(shellCanAttach({ shell: shell('running'), workspacePathMissing: false })).toBe(
      true,
    );
    expect(shellCanAttach({ shell: shell('running'), workspacePathMissing: true })).toBe(
      false,
    );
    expect(shellCanAttach({ shell: shell('missing', 'not_found'), workspacePathMissing: false })).toBe(
      false,
    );
  });

  it('selects an initial active live shell from active id, current shell, or fallback', () => {
    const first = shell('first');
    const second = shell('second');
    expect(
      selectInitialActiveShell(
        shellState([first, second], { activeShellId: 'second' }),
      )?.id,
    ).toBe('second');
    expect(
      selectInitialActiveShell(
        shellState([shell('old', 'exited'), second], {
          activeShellId: 'old',
          shell: second,
        }),
      )?.id,
    ).toBe('second');
    expect(
      selectInitialActiveShell(shellState([shell('old', 'exited')]))
    ).toBeNull();
  });

  it('builds connection button labels, disabled state, and styling intent', () => {
    const connected = buildConnectionButtonState({
      activeRuntime: {
        ...EMPTY_SHELL_PANE_RUNTIME_STATE,
        shellInputEnabled: true,
      },
      activeShell: shell('running'),
      busy: false,
      loading: false,
      status: 'attached',
      workspacePathMissing: false,
    });
    expect(connected).toMatchObject({
      disabled: false,
      label: 'Disconnect shell',
    });
    expect(connected.className).toContain('sky');

    const missingWorkspace = buildConnectionButtonState({
      activeRuntime: EMPTY_SHELL_PANE_RUNTIME_STATE,
      activeShell: null,
      busy: false,
      loading: false,
      status: 'not_created',
      workspacePathMissing: true,
    });
    expect(missingWorkspace).toMatchObject({
      disabled: true,
      label: 'Create shell',
    });
    expect(missingWorkspace.className).toContain('rose');

    const restart = buildConnectionButtonState({
      activeRuntime: EMPTY_SHELL_PANE_RUNTIME_STATE,
      activeShell: shell('old', 'exited'),
      busy: false,
      loading: false,
      status: 'exited',
      workspacePathMissing: false,
    });
    expect(restart.label).toBe('Restart shell');
  });

  it('compares runtime states and builds the public control state', () => {
    const runtime: ShellPaneRuntimeState = {
      status: 'attached',
      shellInputEnabled: true,
      isConnecting: false,
      isCommandRunning: true,
      promptLabel: null,
      error: null,
      hasShell: true,
    };
    expect(runtimeStatesEqual(runtime, { ...runtime })).toBe(true);
    expect(runtimeStatesEqual(runtime, { ...runtime, isCommandRunning: false })).toBe(
      false,
    );

    expect(
      buildShellControlState({
        activeRuntime: runtime,
        activeShell: shell('main'),
        connectionButtonDisabled: false,
        connectionButtonLabel: 'Disconnect shell',
        isMobileShell: true,
        busy: false,
        loading: false,
        error: 'outer error',
      }),
    ).toMatchObject({
      status: 'attached',
      connectionButtonDisabled: false,
      connectionButtonLabel: 'Disconnect shell',
      shellInputEnabled: true,
      isCommandRunning: true,
      promptLabel: 'main',
      isMobileShell: true,
      hasShell: true,
      error: 'outer error',
    });
  });
});
