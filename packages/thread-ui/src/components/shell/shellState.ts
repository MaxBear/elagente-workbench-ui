import { translate, useI18n } from '../../i18n';
import type {
  ShellSessionDto,
  ShellStatusDto,
  ThreadShellStateDto,
} from '@remote-codex/shared';

import { basenameFromPath, buildPromptLabel } from './shellPresentation';

/** Panes are keyed by shell id; tests and older callers use fixed names. */
export type ShellPaneId = string;

export interface ShellPaneRuntimeState {
  status: ShellStatusDto;
  shellInputEnabled: boolean;
  isConnecting: boolean;
  isCommandRunning: boolean;
  promptLabel: string | null;
  error: string | null;
  hasShell: boolean;
}

export interface ThreadShellControlState {
  status: ShellStatusDto;
  connectionButtonDisabled: boolean;
  connectionButtonLabel: string;
  shellInputEnabled: boolean;
  isConnecting: boolean;
  isCommandRunning: boolean;
  promptLabel: string | null;
  isMobileShell: boolean;
  hasShell: boolean;
  busy: boolean;
  loading: boolean;
  error: string | null;
}

export const EMPTY_SHELL_PANE_RUNTIME_STATE: ShellPaneRuntimeState = {
  status: 'not_created',
  shellInputEnabled: false,
  isConnecting: false,
  isCommandRunning: false,
  promptLabel: null,
  error: null,
  hasShell: false,
};

export function isLiveShell(shell: ShellSessionDto) {
  return shell.status !== 'exited' && shell.status !== 'not_found';
}

export function shellCanAttach({
  shell,
  workspacePathMissing,
}: {
  shell: ShellSessionDto | null;
  workspacePathMissing: boolean;
}) {
  return Boolean(shell && !workspacePathMissing && isLiveShell(shell));
}

export function runtimeStatesEqual(
  left: ShellPaneRuntimeState,
  right: ShellPaneRuntimeState,
) {
  return (
    left.status === right.status &&
    left.shellInputEnabled === right.shellInputEnabled &&
    left.isConnecting === right.isConnecting &&
    left.isCommandRunning === right.isCommandRunning &&
    left.promptLabel === right.promptLabel &&
    left.error === right.error &&
    left.hasShell === right.hasShell
  );
}

export function selectInitialActiveShell(shellState: ThreadShellStateDto) {
  return (
    (shellState.activeShellId
      ? shellState.shells.find(
          (shell) => shell.id === shellState.activeShellId && isLiveShell(shell),
        )
      : null) ??
    (shellState.shell && isLiveShell(shellState.shell) ? shellState.shell : null) ??
    shellState.shells.find(isLiveShell) ??
    null
  );
}

export function buildConnectionButtonState({
  activeRuntime,
  activeShell,
  busy,
  loading,
  status,
  workspacePathMissing,
}: {
  activeRuntime: ShellPaneRuntimeState;
  activeShell: ShellSessionDto | null;
  busy: boolean;
  loading: boolean;
  status: ShellStatusDto;
  workspacePathMissing: boolean;
}) {
  const disabled =
    busy || loading || status === 'creating' || workspacePathMissing;
  const label = activeRuntime.shellInputEnabled
    ? translate("workbench.disconnectShell")
    : activeShell && !isLiveShell(activeShell)
      ? translate("workbench.restartShell")
      : activeShell
        ? translate("workbench.connectShell")
        : translate("workbench.createShell");
  const className = activeRuntime.shellInputEnabled
    ? 'border-sky-300/45 bg-sky-300/18 text-sky-50 ring-1 ring-sky-300/20 hover:bg-sky-300/24'
    : activeShell && !isLiveShell(activeShell)
      ? 'border-stone-600 bg-stone-800/90 text-stone-100 hover:border-stone-500 hover:bg-stone-800'
      : workspacePathMissing
        ? 'border-rose-300/35 bg-rose-300/12 text-rose-100'
        : 'border-stone-600 bg-stone-800/90 text-stone-100 hover:border-stone-500 hover:bg-stone-800';

  return { disabled, label, className };
}

export function buildShellControlState({
  activeRuntime,
  activeShell,
  connectionButtonDisabled,
  connectionButtonLabel,
  isMobileShell,
  busy,
  loading,
  error,
}: {
  activeRuntime: ShellPaneRuntimeState;
  activeShell: ShellSessionDto | null;
  connectionButtonDisabled: boolean;
  connectionButtonLabel: string;
  isMobileShell: boolean;
  busy: boolean;
  loading: boolean;
  error: string | null;
}): ThreadShellControlState {
  return {
    status: activeRuntime.status,
    connectionButtonDisabled,
    connectionButtonLabel,
    shellInputEnabled: activeRuntime.shellInputEnabled,
    isConnecting: activeRuntime.isConnecting,
    isCommandRunning: activeRuntime.isCommandRunning,
    promptLabel:
      activeRuntime.promptLabel ??
      (activeShell ? buildPromptLabel(basenameFromPath(activeShell.cwd), null) : null),
    isMobileShell,
    hasShell: Boolean(activeShell),
    busy,
    loading,
    error: activeRuntime.error ?? error,
  };
}
