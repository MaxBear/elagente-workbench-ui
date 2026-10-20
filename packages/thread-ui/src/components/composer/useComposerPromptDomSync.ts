import {
  useLayoutEffect,
  type MutableRefObject,
  type RefObject,
} from 'react';

import {
  attachmentDisplayLabel,
  type PromptSegment,
  type PromptSelectionRange,
} from './composerUtils';
import { restoreSelectionAfterInsertedAttachments } from './contentEditablePrompt';

interface UseComposerPromptDomSyncInput {
  promptRef: RefObject<HTMLDivElement | null>;
  isShellView: boolean;
  prompt: string;
  promptSegments: PromptSegment[];
  attachmentPreviewUrls: Record<string, string>;
  previewSignature: string;
  pendingSelectionRef: MutableRefObject<PromptSelectionRange | null>;
  pendingInsertedAttachmentIdsRef: MutableRefObject<string[]>;
  selectionSnapshotRef: MutableRefObject<PromptSelectionRange | null>;
  renderedPreviewSignatureRef: MutableRefObject<string>;
  serializeEditorPrompt: () => string;
  restoreSelection: (selection: PromptSelectionRange | null) => void;
}

function createPromptAttachmentToken(
  segment: Extract<PromptSegment, { type: 'attachment' }>,
  attachmentPreviewUrls: Record<string, string>,
) {
  const { attachment } = segment;
  const token = document.createElement('span');
  token.dataset.segmentType = 'attachment';
  token.dataset.clientId = attachment.clientId;
  token.dataset.placeholder = attachment.placeholder;
  token.contentEditable = 'false';
  token.className =
    'thread-composer-attachment-chip mx-[0.12rem] inline-flex max-w-full align-baseline';

  if (attachment.kind === 'photo') {
    token.classList.add(
      'thread-composer-attachment-chip-photo',
      'rounded-[0.95rem]',
      'border',
      'border-sky-300/35',
      'bg-sky-300/10',
      'p-1',
      'shadow-sm',
      'shadow-stone-950/20',
    );

    const previewUrl = attachmentPreviewUrls[attachment.clientId];
    if (previewUrl) {
      token.setAttribute('role', 'button');
      token.setAttribute('aria-label', `Open image preview: ${attachment.originalName || 'Pasted image'}`);
      token.tabIndex = 0;
      token.classList.add('cursor-zoom-in');
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = attachment.originalName || 'Pasted image';
      image.className =
        'thread-composer-attachment-thumb h-[4.5rem] w-[6rem] rounded-[0.7rem] bg-stone-950 object-contain';
      image.draggable = false;
      token.append(image);
    } else {
      const imagePlaceholder = document.createElement('span');
      imagePlaceholder.className =
        'thread-composer-attachment-thumb inline-block h-[4.5rem] w-[6rem] rounded-[0.7rem] bg-stone-900/80';
      imagePlaceholder.setAttribute('aria-hidden', 'true');
      token.append(imagePlaceholder);
    }

    const caption = document.createElement('span');
    caption.className =
      'thread-composer-attachment-caption ml-2 inline-flex max-w-[8rem] items-center text-[10px] font-medium tracking-[0.08em] text-sky-50';
    caption.textContent = attachmentDisplayLabel(attachment);

    token.append(caption);
    return token;
  }

  token.classList.add(
    'items-center',
    'gap-2',
    'rounded-[0.95rem]',
    'border',
    'border-emerald-300/35',
    'bg-emerald-300/10',
    'px-2.5',
    'py-2',
    'text-[10px]',
    'font-medium',
    'tracking-[0.08em]',
    'text-emerald-50',
    'shadow-sm',
    'shadow-stone-950/20',
  );

  const icon = document.createElement('span');
  icon.className =
    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200/25 bg-emerald-300/12 text-[9px]';
  icon.textContent = 'FILE';

  const label = document.createElement('span');
  label.className = 'inline-flex max-w-[10rem] truncate';
  label.textContent = attachmentDisplayLabel(attachment);

  token.append(icon, label);
  return token;
}

function buildPromptFragment(
  promptSegments: PromptSegment[],
  attachmentPreviewUrls: Record<string, string>,
) {
  const fragment = document.createDocumentFragment();

  for (const segment of promptSegments) {
    if (segment.type === 'text') {
      fragment.append(
        document.createTextNode(segment.text === ' ' ? '\u00a0' : segment.text),
      );
      continue;
    }

    fragment.append(createPromptAttachmentToken(segment, attachmentPreviewUrls));
  }

  return fragment;
}

export function useComposerPromptDomSync({
  promptRef,
  isShellView,
  prompt,
  promptSegments,
  attachmentPreviewUrls,
  previewSignature,
  pendingSelectionRef,
  pendingInsertedAttachmentIdsRef,
  selectionSnapshotRef,
  renderedPreviewSignatureRef,
  serializeEditorPrompt,
  restoreSelection,
}: UseComposerPromptDomSyncInput) {
  useLayoutEffect(() => {
    const editor = promptRef.current;
    if (!editor || isShellView || editor.dataset.imeComposing === 'true') {
      return;
    }

    const pendingSelection = pendingSelectionRef.current;
    const shouldSyncDom = serializeEditorPrompt() !== prompt;

    if (shouldSyncDom) {
      editor.replaceChildren(
        buildPromptFragment(promptSegments, attachmentPreviewUrls),
      );
    } else if (renderedPreviewSignatureRef.current !== previewSignature) {
      // A thumbnail becoming available must not replace the text nodes tracked
      // by native dictation/autocorrection, or disturb its live selection.
      const attachments = new Map(promptSegments.flatMap(segment =>
        segment.type === 'attachment' ? [[segment.attachment.clientId, segment] as const] : [],
      ));
      for (const token of editor.querySelectorAll<HTMLElement>('[data-segment-type="attachment"]')) {
        const segment = attachments.get(token.dataset.clientId ?? '');
        if (segment) token.replaceWith(createPromptAttachmentToken(segment, attachmentPreviewUrls));
      }
    }
    renderedPreviewSignatureRef.current = previewSignature;

    if (pendingSelection !== null) {
      editor.focus();
      if (
        !restoreSelectionAfterInsertedAttachments(
          editor,
          pendingInsertedAttachmentIdsRef.current,
        )
      ) {
        restoreSelection(pendingSelection);
      }
      selectionSnapshotRef.current = pendingSelection;
    } else if (document.activeElement === editor && shouldSyncDom) {
      restoreSelection(selectionSnapshotRef.current);
    }

    pendingSelectionRef.current = null;
    pendingInsertedAttachmentIdsRef.current = [];
  }, [
    attachmentPreviewUrls,
    isShellView,
    previewSignature,
    prompt,
    promptRef,
    promptSegments,
    pendingInsertedAttachmentIdsRef,
    pendingSelectionRef,
    renderedPreviewSignatureRef,
    restoreSelection,
    selectionSnapshotRef,
    serializeEditorPrompt,
  ]);
}
