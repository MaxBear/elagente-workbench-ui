// @vitest-environment jsdom
import { createRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { serializeEditorPrompt } from './contentEditablePrompt';
import { useComposerPromptDomSync } from './useComposerPromptDomSync';
import type { PromptSegment } from './composerUtils';

it('updates an asynchronous image preview without replacing dictation text or moving its selection', () => {
  const editor = document.createElement('div');
  editor.tabIndex = 0;
  editor.innerHTML = '<span style="color:inherit">dictated text</span><span data-segment-type="attachment" data-client-id="photo" data-placeholder="[PHOTO a.png]" contenteditable="false"></span> tail';
  document.body.append(editor);
  const dictated = editor.firstChild!.firstChild!;
  const editorRef = createRef<HTMLDivElement>();
  editorRef.current = editor;
  const segments: PromptSegment[] = [
    { type: 'text', key: 'before', text: 'dictated text' },
    { type: 'attachment', key: 'photo', attachment: { clientId: 'photo', placeholder: '[PHOTO a.png]', kind: 'photo', originalName: 'a.png', file: new File([], 'a.png') } },
    { type: 'text', key: 'after', text: ' tail' },
  ];
  const pending = { current: null };
  const inserted = { current: [] };
  const preview = { current: '' };
  function Harness({ url }: { url: string }) {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false,
      prompt: 'dictated text[PHOTO a.png] tail', promptSegments: segments,
      attachmentPreviewUrls: url ? { photo: url } : {}, previewSignature: url,
      pendingSelectionRef: pending, pendingInsertedAttachmentIdsRef: inserted,
      selectionSnapshotRef: pending, renderedPreviewSignatureRef: preview,
      serializeEditorPrompt: () => serializeEditorPrompt(editor), restoreSelection: () => { throw new Error('Native selection must not be restored'); },
    });
    return null;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<Harness url="" />));
  editor.focus();
  const range = document.createRange();
  range.setStart(dictated, 3); range.collapse(true);
  window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
  flushSync(() => root.render(<Harness url="blob:preview" />));
  expect(editor.firstChild!.firstChild).toBe(dictated);
  expect(window.getSelection()?.anchorNode).toBe(dictated);
  expect(window.getSelection()?.anchorOffset).toBe(3);
  expect(editor.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
  expect(serializeEditorPrompt(editor)).toBe('dictated text[PHOTO a.png] tail');
  flushSync(() => root.unmount());
  editor.remove();
});
