import { translate, useI18n } from '../../i18n';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import type { ThreadShellControlState } from '../../types';
import { ClipboardIcon, ToolPill } from './composerPresentation';

export function ComposerShellToolsPanel({
  busy,
  shellControlState,
  onPaste,
  onCopy,
  onClear,
  onShellControl,
}: {
  busy: boolean;
  shellControlState: ThreadShellControlState | null;
  onPaste: () => void;
  onCopy: () => void;
  onClear: () => void;
  onShellControl: (
    action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down',
  ) => void;
}) {
  useI18n();
  const shellInputEnabled = Boolean(shellControlState?.shellInputEnabled);
  const commandRunning = Boolean(shellControlState?.isCommandRunning);

  return (
    <ComposerMenuSurface
      align="end"
      className="w-[11.5rem] rounded-[1rem] border border-stone-700/90 bg-stone-950/96 p-2 shadow-2xl shadow-stone-950/40 sm:w-48"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onTouchStart={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onPaste}
          className="inline-flex items-center justify-center rounded-full border border-sky-300/35 bg-sky-300/12 px-2 py-2 text-sky-50"
        >
          <span className="inline-flex items-center gap-1.5">
            <ClipboardIcon />
            <span className="text-[10px] font-medium tracking-[0.12em]">
              {translate("chat.paste")}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center rounded-full border border-stone-700/90 bg-stone-900/80 px-2 py-2 text-stone-100"
        >
          <span className="inline-flex items-center gap-1.5">
            <ClipboardIcon />
            <span className="text-[10px] font-medium tracking-[0.12em]">
              {translate("chat.copy")}</span>
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClear}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label={translate("chat.cLEAR")} tone="sky" />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled || !commandRunning}
          onClick={() => onShellControl('ctrl_c')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label="CTRL-C" tone="rose" />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled}
          onClick={() => onShellControl('ctrl_d')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label="CTRL-D" />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled}
          onClick={() => onShellControl('esc')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label="ESC" />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled}
          onClick={() => onShellControl('tab')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label="TAB" />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled}
          onClick={() => onShellControl('up')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label={translate("chat.uP")} />
        </button>
        <button
          type="button"
          disabled={!shellInputEnabled}
          onClick={() => onShellControl('down')}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ToolPill label={translate("chat.dOWN")} />
        </button>
      </div>
    </ComposerMenuSurface>
  );
}
