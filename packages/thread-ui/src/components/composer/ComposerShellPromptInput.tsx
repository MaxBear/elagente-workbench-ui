import { translate, useI18n } from '../../i18n';
import type { KeyboardEvent } from 'react';

export function ComposerShellPromptInput({
  prompt,
  promptPlaceholder,
  promptRegionClassName,
  promptInputClassName,
  interruptLabel,
  canInterrupt,
  sendButtonLabel,
  sendButtonClassName,
  sendDisabled,
  onPromptChange,
  onPromptKeyDown,
  onInterrupt,
}: {
  prompt: string;
  promptPlaceholder: string;
  promptRegionClassName: string;
  promptInputClassName: string;
  interruptLabel: string;
  canInterrupt: boolean;
  sendButtonLabel: string;
  sendButtonClassName: string;
  sendDisabled: boolean;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInterrupt?: () => Promise<void> | void;
}) {
  useI18n();
  return (
    <div className={`${promptRegionClassName} relative`}>
      <textarea
        aria-label={translate("chat.prompt")}
        disabled={false}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={onPromptKeyDown}
        rows={2}
        placeholder={promptPlaceholder}
        className={`${promptInputClassName} resize-y pb-10`}
      />
      <button
        type="button"
        aria-label={interruptLabel}
        title={interruptLabel}
        onClick={() => void onInterrupt?.()}
        disabled={!canInterrupt}
        className={`absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          canInterrupt
            ? 'border-rose-300/55 bg-rose-300/[0.14] text-rose-50 shadow-lg shadow-rose-950/20 hover:bg-rose-300/[0.22]'
            : 'cursor-not-allowed border-stone-700/30 bg-stone-400/[0.02] text-stone-500/55 opacity-55'
        }`}
      >
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 rounded-[2px] bg-current"
        />
      </button>
      <button
        type="submit"
        aria-label={translate("chat.sendShellInput")}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          event.preventDefault();
        }}
        onTouchStart={(event) => {
          event.preventDefault();
        }}
        disabled={sendDisabled}
        className={`absolute bottom-2.5 right-2.5 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-lg shadow-stone-950/30 transition disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-300 ${sendButtonClassName}`}
      >
        {sendButtonLabel}
      </button>
    </div>
  );
}
