import type {
  AgentHookDto,
  AgentHookEventNameDto,
  ThreadHooksDto,
  UpdateThreadHookInput,
} from '@remote-codex/shared';

import {
  editableHookTarget,
  hookEventJsonKey,
  hookEventLabel,
  HOOK_EVENT_OPTIONS,
  hookSourceLabel,
  hookTrustLabel,
} from './composerPresentation';
import type { HookScope, HooksPanelMode, SlashPanelState } from './types';

interface ComposerHooksPanelProps {
  hooksPanelMode: HooksPanelMode;
  hooksState: SlashPanelState<ThreadHooksDto>;
  hostConfigFilesAvailable: boolean;
  hookTrustAvailable: boolean;
  hookConfigBusy: boolean;
  hookConfigError: string | null;
  hookConfigSuccess: string | null;
  editingHookTarget: UpdateThreadHookInput['target'] | null;
  hookScope: HookScope;
  hookEventName: AgentHookEventNameDto;
  hookMatcher: string;
  hookCommand: string;
  hookTimeoutSec: string;
  hookStatusMessage: string;
  composerChipButtonClassName: string;
  onResetHookForm: () => void;
  onSetHooksPanelMode: (mode: HooksPanelMode) => void;
  onClearHookConfigStatus: () => void;
  onSetEditingHookTarget: (target: UpdateThreadHookInput['target'] | null) => void;
  onSetHookScope: (scope: HookScope) => void;
  onSetHookEventName: (eventName: AgentHookEventNameDto) => void;
  onSetHookMatcher: (value: string) => void;
  onSetHookCommand: (value: string) => void;
  onSetHookTimeoutSec: (value: string) => void;
  onSetHookStatusMessage: (value: string) => void;
  onSaveHook: () => Promise<void> | void;
  onStartEditingHook: (hook: AgentHookDto) => void;
  onTrustHook: (hook: AgentHookDto) => Promise<void> | void;
  onUntrustHook: (hook: AgentHookDto) => Promise<void> | void;
}

export function ComposerHooksPanel({
  hooksPanelMode,
  hooksState,
  hostConfigFilesAvailable,
  hookTrustAvailable,
  hookConfigBusy,
  hookConfigError,
  hookConfigSuccess,
  editingHookTarget,
  hookScope,
  hookEventName,
  hookMatcher,
  hookCommand,
  hookTimeoutSec,
  hookStatusMessage,
  composerChipButtonClassName,
  onResetHookForm,
  onSetHooksPanelMode,
  onClearHookConfigStatus,
  onSetEditingHookTarget,
  onSetHookScope,
  onSetHookEventName,
  onSetHookMatcher,
  onSetHookCommand,
  onSetHookTimeoutSec,
  onSetHookStatusMessage,
  onSaveHook,
  onStartEditingHook,
  onTrustHook,
  onUntrustHook,
}: ComposerHooksPanelProps) {
  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-stone-400">Hook config sources</p>
          <p className="truncate text-[11px] text-stone-500">
            {hooksState.data?.projectHooksPath ?? '<workspace hooks config>'}
          </p>
        </div>
        {hooksPanelMode === 'list' && hostConfigFilesAvailable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onResetHookForm();
              onSetHooksPanelMode('add');
              onClearHookConfigStatus();
            }}
            className="shrink-0 rounded-full border border-sky-300/35 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-300/10"
          >
            Add Hook
          </button>
        ) : null}
      </div>
      {hooksState.status === 'loading' && !hooksState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          Loading hooks...
        </p>
      ) : null}
      {hooksState.error ? (
        <p className="mb-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm text-rose-100/90">
          {hooksState.error}
        </p>
      ) : null}
      {hookConfigError ? (
        <p className="mb-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm text-rose-100/90">
          {hookConfigError}
        </p>
      ) : null}
      {hookConfigSuccess ? (
        <p className="mb-2 rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-3 text-sm text-sky-100/90">
          {hookConfigSuccess}
        </p>
      ) : null}
      {hooksPanelMode === 'add' || hooksPanelMode === 'edit' ? (
        <div className="space-y-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3">
          {hooksPanelMode === 'edit' ? (
            <p className="rounded-lg border border-stone-800 bg-stone-950 px-3 py-2 text-[11px] text-stone-400">
              Editing{' '}
              {hookEventJsonKey(editingHookTarget?.eventName ?? hookEventName)}{' '}
              in {editingHookTarget?.scope === 'global' ? 'global' : 'project'}{' '}
              hooks.json
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-stone-400">
              Scope
              <select
                aria-label="Hook scope"
                value={hookScope}
                onChange={(event) => onSetHookScope(event.target.value as HookScope)}
                disabled={hooksPanelMode === 'edit'}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              >
                <option value="project">Project</option>
                <option value="global">Global</option>
              </select>
            </label>
            <label className="block text-xs text-stone-400">
              Event
              <select
                aria-label="Hook event"
                value={hookEventName}
                onChange={(event) =>
                  onSetHookEventName(event.target.value as AgentHookEventNameDto)
                }
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              >
                {HOOK_EVENT_OPTIONS.map((eventOption) => (
                  <option key={eventOption.value} value={eventOption.value}>
                    {eventOption.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-400">
              Matcher
            </label>
            <input
              aria-label="Hook matcher"
              value={hookMatcher}
              onChange={(event) => onSetHookMatcher(event.target.value)}
              placeholder="Bash"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-400">
              Command
            </label>
            <textarea
              aria-label="Hook command"
              value={hookCommand}
              onChange={(event) => onSetHookCommand(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-xs text-stone-100 outline-none placeholder:text-stone-500 focus:border-sky-300/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-stone-400">
              Timeout
              <input
                aria-label="Hook timeout seconds"
                value={hookTimeoutSec}
                onChange={(event) => onSetHookTimeoutSec(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              />
            </label>
            <label className="block text-xs text-stone-400">
              Status message
              <input
                aria-label="Hook status message"
                value={hookStatusMessage}
                onChange={(event) => onSetHookStatusMessage(event.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-sky-300/50"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSetHooksPanelMode('list');
                onSetEditingHookTarget(null);
              }}
              className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-3 py-1.5 text-xs text-stone-300 transition`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void onSaveHook()}
              disabled={hookConfigBusy}
              className="ui-status-info rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hookConfigBusy
                ? 'Saving...'
                : hooksPanelMode === 'edit'
                  ? 'Update Hook'
                  : 'Write Hook'}
            </button>
          </div>
        </div>
      ) : null}
      {hooksPanelMode === 'list' && hooksState.data?.warnings.length ? (
        <div className="mb-2 space-y-2">
          {hooksState.data.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/85"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}
      {hooksPanelMode === 'list' && hooksState.data?.errors.length ? (
        <div className="mb-2 space-y-2">
          {hooksState.data.errors.map((entry) => (
            <div
              key={`${entry.path}:${entry.message}`}
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90"
            >
              <p className="font-medium">{entry.message}</p>
              <p className="mt-1 break-all text-rose-100/60">
                {entry.path}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {hooksPanelMode === 'list' && hooksState.data?.hooks.length ? (
        <div className="space-y-2">
          {hooksState.data.hooks.map((hook) => (
            <div
              key={hook.key}
              className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-100">
                  {hookEventLabel(hook.eventName)}
                  {hook.matcher ? ` · ${hook.matcher}` : ''}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-stone-400">
                  {hook.command ?? hook.handlerType}
                </p>
                {hook.statusMessage ? (
                  <p className="mt-1 truncate text-[11px] text-stone-500">
                    {hook.statusMessage}
                  </p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-stone-500">
                {editableHookTarget(hook) ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEditingHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/10`}
                  >
                    Edit
                  </button>
                ) : null}
                {hookTrustAvailable &&
                hook.trustStatus === 'trusted' &&
                !hook.isManaged ? (
                  <button
                    type="button"
                    disabled={hookConfigBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUntrustHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-100 transition hover:border-amber-300/35 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Untrust
                  </button>
                ) : null}
                {(hook.trustStatus === 'untrusted' ||
                  hook.trustStatus === 'modified') &&
                !hook.isManaged &&
                hookTrustAvailable ? (
                  <button
                    type="button"
                    disabled={hookConfigBusy || !hook.currentHash}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onTrustHook(hook);
                    }}
                    className={`${composerChipButtonClassName} rounded-full border border-stone-700 px-2 py-0.5 text-[10px] normal-case tracking-normal text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Trust
                  </button>
                ) : null}
                <span className="rounded-full border border-stone-700 px-2 py-0.5 text-stone-300">
                  {hookTrustLabel(hook.trustStatus)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hookSourceLabel(hook.source)}
                </span>
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hook.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="rounded-full border border-stone-700 px-2 py-1">
                  {hook.timeoutSec}s
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {hooksPanelMode === 'list' &&
      hooksState.status !== 'loading' &&
      !hooksState.error &&
      (hooksState.data?.hooks.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          No hooks configured for this workspace.
        </p>
      ) : null}
    </div>
  );
}
