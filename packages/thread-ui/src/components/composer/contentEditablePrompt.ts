export function textFromClipboardHtml(value: string) {
  if (!value) {
    return '';
  }

  const container = document.createElement('div');
  container.innerHTML = value;
  return serializePromptContent(container, false);
}

export function editorContainsStyledRichText(editor: HTMLDivElement) {
  return Array.from(editor.querySelectorAll('[style], font')).some(
    node => !node.closest('[data-segment-type="attachment"][contenteditable="false"]'),
  );
}

export interface EditorSelectionOffsets {
  start: number;
  end: number;
}

const BLOCK_PROMPT_TAGS = new Set(['DIV', 'LI', 'P']);

function serializePromptNode(node: ChildNode, currentText: string): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return currentText + (node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return currentText;
  }

  if (node.dataset.segmentType === 'attachment' && node.dataset.placeholder) {
    return currentText + node.dataset.placeholder;
  }

  if (node.tagName === 'BR') {
    return `${currentText}\n`;
  }

  let nextText = currentText;
  if (
    BLOCK_PROMPT_TAGS.has(node.tagName) &&
    nextText.length > 0 &&
    !nextText.endsWith('\n')
  ) {
    nextText += '\n';
  }

  for (const child of Array.from(node.childNodes)) {
    nextText = serializePromptNode(child, nextText);
  }
  return nextText;
}

function serializePromptContent(root: HTMLElement, normalizeNbsp = true) {
  let text = '';
  for (const child of Array.from(root.childNodes)) {
    text = serializePromptNode(child, text);
  }
  return normalizeNbsp ? text.replace(/\u00a0/g, ' ') : text;
}

export function segmentNodeText(child: ChildNode) {
  if (
    child instanceof HTMLElement &&
    child.dataset.segmentType === 'attachment' &&
    child.dataset.placeholder
  ) {
    return child.dataset.placeholder;
  }

  return serializePromptNode(child, '');
}

export function serializeEditorPrompt(editor: HTMLDivElement) {
  return serializePromptContent(editor);
}

export function measureSelectionOffset(
  root: HTMLDivElement,
  container: Node,
  offset: number,
) {
  // Native dictation/IME can wrap or split text nodes. Measure the serialized
  // prefix, including block line breaks and attachment placeholders, rather
  // than assuming the selection lives in a direct child of the editor.
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(container, offset);
  } catch {
    return serializeEditorPrompt(root).length;
  }
  const prefix = document.createElement('div');
  prefix.append(range.cloneContents());
  return serializePromptContent(prefix).length;
}

export function snapshotEditorSelection(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (
    !editor.contains(range.startContainer) ||
    !editor.contains(range.endContainer)
  ) {
    return null;
  }

  return {
    start: measureSelectionOffset(
      editor,
      range.startContainer,
      range.startOffset,
    ),
    end: measureSelectionOffset(editor, range.endContainer, range.endOffset),
  };
}

export function resolveOffsetToDomPosition(
  root: HTMLDivElement,
  targetOffset: number,
) {
  const target = Math.max(0, targetOffset);
  let text = '';
  type Position = { node: Node; offset: number };
  function visit(parent: Node): Position | null {
    const children = Array.from(parent.childNodes);
    for (const [index, child] of children.entries()) {
      if (child.nodeType === Node.TEXT_NODE) {
        const end = text.length + (child.textContent?.length ?? 0);
        if (target <= end) return { node: child, offset: target - text.length };
        text += child.textContent ?? '';
      } else if (child instanceof HTMLElement) {
        if (child.dataset.segmentType === 'attachment' && child.dataset.placeholder) {
          if (target === text.length) return { node: parent, offset: index };
          text += child.dataset.placeholder;
          if (target <= text.length) {
            const next = children[index + 1];
            return target === text.length && next?.nodeType === Node.TEXT_NODE
              ? { node: next, offset: 0 }
              : { node: parent, offset: index + 1 };
          }
        } else if (child.tagName === 'BR') {
          if (target === text.length) return { node: parent, offset: index };
          text += '\n';
          if (target === text.length) return { node: parent, offset: index + 1 };
        } else {
          if (BLOCK_PROMPT_TAGS.has(child.tagName) && text.length > 0 && !text.endsWith('\n')) {
            text += '\n';
            if (target <= text.length) return { node: child, offset: 0 };
          }
          const position = visit(child);
          if (position) return position;
        }
      }
    }
    return null;
  }
  return visit(root) ?? { node: root, offset: root.childNodes.length };
}

export function restoreEditorSelection(
  editor: HTMLDivElement,
  selection: EditorSelectionOffsets,
) {
  const startPosition = resolveOffsetToDomPosition(editor, selection.start);
  const endPosition = resolveOffsetToDomPosition(editor, selection.end);
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);

  const currentSelection = window.getSelection();
  currentSelection?.removeAllRanges();
  currentSelection?.addRange(range);
}

export function restoreSelectionAfterInsertedAttachments(
  editor: HTMLDivElement,
  insertedClientIds: string[],
) {
  if (insertedClientIds.length === 0) {
    return false;
  }

  const lastInsertedClientId = insertedClientIds.at(-1);
  if (!lastInsertedClientId) {
    return false;
  }

  const attachmentNode = Array.from(editor.childNodes).find(
    (child) =>
      child instanceof HTMLElement &&
      child.dataset.segmentType === 'attachment' &&
      child.dataset.clientId === lastInsertedClientId,
  );

  if (!(attachmentNode instanceof HTMLElement)) {
    return false;
  }

  const range = document.createRange();
  const trailingNode = attachmentNode.nextSibling;
  if (trailingNode?.nodeType === Node.TEXT_NODE) {
    range.setStart(trailingNode, 0);
  } else {
    range.setStartAfter(attachmentNode);
  }
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}
