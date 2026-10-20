import { useRef, useState } from 'react';
import { GraphWorkspaceImageLightbox } from '../ZoomableImage';
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from 'react';

import { InputGroupButton } from '../graph-ui/InputGroup';

interface ComposerPromptEditorProps {
  promptRef: RefObject<HTMLDivElement | null>;
  prompt: string;
  disabled: boolean;
  promptPlaceholder: string;
  canInterrupt: boolean;
  interruptLabel: string;
  composerPromptRegionClassName: string;
  graphChatInputClassName: string;
  onInterrupt?: () => Promise<void> | void;
  onInput: () => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp: () => void;
  onMouseUp: () => void;
  onBlur: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function hasIOSNativeBridge() {
  const nativeWindow = window as Window & {
    webkit?: {
      messageHandlers?: {
        remoteCodex?: unknown;
      };
    };
  };
  return Boolean(nativeWindow.webkit?.messageHandlers?.remoteCodex);
}

export function ComposerPromptEditor({
  promptRef,
  prompt,
  disabled,
  promptPlaceholder,
  canInterrupt,
  interruptLabel,
  composerPromptRegionClassName,
  graphChatInputClassName,
  onInterrupt,
  onInput,
  onPointerDown,
  onPaste,
  onKeyDown,
  onKeyUp,
  onMouseUp,
  onBlur,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: ComposerPromptEditorProps) {
  const previewTrigger = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{src: string; alt: string} | null>(null);
  function attachmentImage(target: EventTarget | null) {
    const chip = target instanceof Element ? target.closest<HTMLElement>('[data-segment-type="attachment"]') : null;
    if (chip?.querySelector('img')) previewTrigger.current = chip;
    return chip?.querySelector('img');
  }
  return (
    <div
      data-slot="input-group-control"
      className={`${composerPromptRegionClassName} relative w-full ${canInterrupt ? "z-[90]" : ""}`}
    >
      <div className={graphChatInputClassName}>
        {prompt.length === 0 && promptPlaceholder && (
          <span
            className={`pointer-events-none absolute left-3 top-3 truncate text-slate-500 sm:left-4 sm:top-4 dark:text-slate-400 ${
              canInterrupt ? 'right-12' : 'right-3 sm:right-4'
            }`}
          >
            {promptPlaceholder}
          </span>
        )}
        <div
          ref={promptRef}
          role="textbox"
          aria-label="Prompt"
          aria-multiline="true"
          contentEditable={disabled ? false : 'plaintext-only'}
          inputMode="text"
          suppressContentEditableWarning
          onClick={event => {
            const image = attachmentImage(event.target);
            if (image) { event.preventDefault(); setPreview({src: image.src, alt: image.alt}); }
          }}
          onPointerDown={(event) => {
            if (attachmentImage(event.target)) { event.preventDefault(); return; }
            if (
              !disabled &&
              document.activeElement !== event.currentTarget &&
              hasIOSNativeBridge()
            ) {
              // WKWebView only opens the software keyboard reliably when focus
              // is requested synchronously from the user's touch gesture.
              event.currentTarget.focus({ preventScroll: true });
            }
            onPointerDown?.(event);
          }}
          onCompositionStart={event => {
            event.currentTarget.dataset.imeComposing = 'true';
          }}
          onCompositionEnd={event => {
            delete event.currentTarget.dataset.imeComposing;
            onInput();
          }}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={event => {
            if (event.currentTarget.dataset.imeComposing === 'true' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            const image = attachmentImage(event.target);
            if (image && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); setPreview({src: image.src, alt: image.alt}); return;
            }
            onKeyDown(event);
          }}
          onKeyUp={onKeyUp}
          onMouseUp={onMouseUp}
          onBlur={onBlur}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative z-[1] min-h-[4.25rem] whitespace-pre-wrap break-words pb-2 outline-none sm:min-h-[4.25rem] ${
            canInterrupt ? 'pr-12' : ''
          } ${disabled ? 'cursor-not-allowed text-slate-500' : ''}`}
        />
      </div>
      {preview ? <GraphWorkspaceImageLightbox src={preview.src} alt={preview.alt} onClose={() => {
        setPreview(null);
        previewTrigger.current?.focus({preventScroll: true});
      }} /> : null}
      {canInterrupt ? (
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={interruptLabel}
          title={interruptLabel}
          onClick={(event) => {
            event.preventDefault();
            void onInterrupt?.();
          }}
          className="thread-graph-composer-stop-button ui-action-danger absolute right-2 top-2 z-[90] h-8 w-8 rounded-full text-sm font-medium pointer-events-auto"
        >
          <span
            aria-hidden="true"
            className="block h-2.5 w-2.5 rounded-[2px] bg-current"
          />
        </InputGroupButton>
      ) : null}
    </div>
  );
}
