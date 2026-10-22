/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import {
  editorContainsStyledRichText,
  measureSelectionOffset,
  resolveOffsetToDomPosition,
  restoreEditorSelection,
  restoreSelectionAfterInsertedAttachments,
  segmentNodeText,
  serializeEditorPrompt,
  snapshotEditorSelection,
  textFromClipboardHtml,
} from './contentEditablePrompt';

describe('contenteditable prompt helpers', () => {
  it('extracts plain text from clipboard HTML', () => {
    expect(
      textFromClipboardHtml('<div>Hello&nbsp;<strong>world</strong></div>'),
    ).toBe('Hello\u00a0world');
    expect(textFromClipboardHtml('')).toBe('');
  });

  it('detects pasted rich-text styling nodes', () => {
    const plainEditor = document.createElement('div');
    plainEditor.textContent = 'plain';
    expect(editorContainsStyledRichText(plainEditor)).toBe(false);

    const styledEditor = document.createElement('div');
    styledEditor.innerHTML = '<span style="font-weight: 700">bold</span>';
    expect(editorContainsStyledRichText(styledEditor)).toBe(true);

    const fontEditor = document.createElement('div');
    fontEditor.innerHTML = '<font color="red">legacy</font>';
    expect(editorContainsStyledRichText(fontEditor)).toBe(true);
  });

  it('serializes attachment chips using their hidden placeholder text', () => {
    const editor = document.createElement('div');
    editor.append(document.createTextNode('Attach '));
    const chip = document.createElement('span');
    chip.dataset.segmentType = 'attachment';
    chip.dataset.placeholder = '[PHOTO cat.png]';
    chip.textContent = 'cat.png';
    editor.append(chip, document.createTextNode('\u00a0done'));

    expect(segmentNodeText(chip)).toBe('[PHOTO cat.png]');
    expect(serializeEditorPrompt(editor)).toBe('Attach [PHOTO cat.png] done');
  });

  it('preserves line breaks created by contenteditable block nodes and br tags', () => {
    const editor = document.createElement('div');
    editor.append(document.createTextNode('first line'));
    const secondLine = document.createElement('div');
    secondLine.textContent = 'second line';
    const blankLine = document.createElement('div');
    blankLine.append(document.createElement('br'));
    const fourthLine = document.createElement('div');
    fourthLine.textContent = 'fourth line';
    editor.append(secondLine, blankLine, fourthLine);

    expect(serializeEditorPrompt(editor)).toBe(
      'first line\nsecond line\n\nfourth line',
    );
  });

  it('preserves line breaks when converting pasted HTML to text', () => {
    expect(
      textFromClipboardHtml('<div>alpha</div><div>beta<br>gamma</div>'),
    ).toBe('alpha\nbeta\ngamma');
  });

  it('measures selection offsets across text and attachment chips', () => {
    const editor = document.createElement('div');
    const before = document.createTextNode('A ');
    const chip = document.createElement('span');
    chip.dataset.segmentType = 'attachment';
    chip.dataset.placeholder = '[FILE report.pdf]';
    chip.textContent = 'report.pdf';
    const after = document.createTextNode(' done');
    editor.append(before, chip, after);

    expect(measureSelectionOffset(editor, before, 1)).toBe(1);
    expect(measureSelectionOffset(editor, editor, 2)).toBe(
      'A [FILE report.pdf]'.length,
    );

    const endPosition = resolveOffsetToDomPosition(
      editor,
      'A [FILE report.pdf]'.length,
    );
    expect(endPosition.node).toBe(after);
    expect(endPosition.offset).toBe(0);
  });

  it('snapshots and restores editor selections by serialized offsets', () => {
    const editor = document.createElement('div');
    const text = document.createTextNode('hello world');
    editor.append(text);
    document.body.append(editor);

    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 5);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    expect(snapshotEditorSelection(editor)).toEqual({ start: 1, end: 5 });

    restoreEditorSelection(editor, { start: 6, end: 11 });
    expect(window.getSelection()?.toString()).toBe('world');

    editor.remove();
  });

  it('preserves selections in dictation wrappers and multiline text around attachments', () => {
    const editor = document.createElement('div');
    editor.innerHTML = 'first<div><span style="color:inherit">hello world</span><span data-segment-type="attachment" data-placeholder="[FILE a.txt]" contenteditable="false">a.txt</span> tail</div>';
    document.body.append(editor);
    const wrapped = editor.querySelector('span')!.firstChild!;
    expect(measureSelectionOffset(editor, wrapped, 6)).toBe('first\nhello '.length);
    restoreEditorSelection(editor, { start: 'first\nhello '.length, end: 'first\nhello world'.length });
    expect(window.getSelection()?.toString()).toBe('world');
    expect(snapshotEditorSelection(editor)).toEqual({ start: 12, end: 17 });
    const after = editor.lastChild!.lastChild!;
    expect(measureSelectionOffset(editor, after, 2)).toBe('first\nhello world[FILE a.txt] t'.length);
    editor.remove();
  });

  it('moves the caret after the last inserted attachment chip', () => {
    const editor = document.createElement('div');
    const chip = document.createElement('span');
    chip.dataset.segmentType = 'attachment';
    chip.dataset.clientId = 'new-file';
    chip.dataset.placeholder = '[FILE report.pdf]';
    chip.textContent = 'report.pdf';
    const trailing = document.createTextNode(' trailing');
    editor.append(chip, trailing);
    document.body.append(editor);

    expect(restoreSelectionAfterInsertedAttachments(editor, ['old-file'])).toBe(
      false,
    );
    expect(restoreSelectionAfterInsertedAttachments(editor, ['new-file'])).toBe(
      true,
    );

    const selection = window.getSelection();
    expect(selection?.anchorNode).toBe(trailing);
    expect(selection?.anchorOffset).toBe(0);

    editor.remove();
  });
});

it('excludes noneditable attachment styling from rich-text cleanup', () => {
  const editor = document.createElement('div');
  editor.innerHTML = '<span data-segment-type="attachment" contenteditable="false" style="cursor:zoom-in"><img style="width:96px"></span>你好';
  expect(editorContainsStyledRichText(editor)).toBe(false);
  editor.insertAdjacentHTML('beforeend', '<span style="color:red">pasted formatting</span>');
  expect(editorContainsStyledRichText(editor)).toBe(true);
});
