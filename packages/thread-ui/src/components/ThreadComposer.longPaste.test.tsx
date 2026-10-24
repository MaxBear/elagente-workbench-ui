// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadComposer } from './ThreadComposer';
import type { PromptAttachmentUpload } from '../types';

// ELA-229: a multi-line paste into the contenteditable prompt fires about one
// `input` event per line. Each used to hand a new attachments array to the
// preview-URL hook, whose state update pushed React past its nested-update
// limit (error #185) about every 53 events.

type Draft = { prompt: string; attachments: PromptAttachmentUpload[] };

let root: Root;
let host: HTMLDivElement;
let draft: Draft;
let reactErrors: unknown[];
const submit = vi.fn();

function Harness() {
  const [value, setValue] = useState<Draft>({ prompt: '', attachments: [] });
  draft = value;
  return (
    <ThreadComposer
      activeView="chat"
      onSubmit={submit}
      draftPrompt={value.prompt}
      draftAttachments={value.attachments}
      onDraftChange={setValue}
    />
  );
}

function setActEnvironment(enabled: boolean) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = enabled;
}

// A long multi-line prompt, like the 3,262-character Optima request.
function longPrompt(lines: number, length: number) {
  const rows = Array.from({ length: lines }, (_, index) =>
    `Step ${index + 1}: optimise the geometry and report the energy.`);
  let text = rows.join('\n');
  while (text.length < length) text += ' Then compare with the reference.';
  return text.slice(0, length).trimEnd();
}

function editor() {
  return host.querySelector<HTMLDivElement>('[role="textbox"]')!;
}

// One `input` event per line, separated by microtask gaps as in Chromium.
async function pasteAsInputBurst(text: string, events: number) {
  const target = editor();
  setActEnvironment(false);
  try {
    for (let index = 1; index <= events; index += 1) {
      const end = index === events ? text.length : Math.round((text.length * index) / events);
      target.textContent = text.slice(0, end);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    }
    // Let the deferred host draft sync (180 ms) run.
    await new Promise((resolve) => setTimeout(resolve, 250));
  } finally {
    setActEnvironment(true);
  }
}

async function pressCtrlEnter() {
  await act(async () => {
    editor().dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
  });
}

beforeEach(async () => {
  setActEnvironment(true);
  reactErrors = [];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host, {
    onUncaughtError: (error) => reactErrors.push(error),
    onCaughtError: (error) => reactErrors.push(error),
    onRecoverableError: (error) => reactErrors.push(error),
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  submit.mockReset();
  submit.mockResolvedValue(true);
  await act(async () => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('composer long multi-line paste (ELA-229)', () => {
  it.each([
    { events: 165, length: 3262 },
    // The burst ends exactly on the event that used to cross the limit.
    { events: 53, length: 1500 },
  ])('keeps $length characters over $events input events and submits them all', async ({ events, length }) => {
    const text = longPrompt(events, length);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await pasteAsInputBurst(text, events);

    const messages = [...reactErrors, ...consoleError.mock.calls.flat()]
      .map((entry) => String(entry instanceof Error ? entry.message : entry));
    expect(messages.filter((message) => /Maximum update depth/.test(message))).toEqual([]);
    expect(reactErrors).toEqual([]);
    expect(draft.prompt).toBe(text);

    await pressCtrlEnter();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]![0]).toMatchObject({ prompt: text });
    expect(editor().textContent).toBe('');
    expect(draft.prompt).toBe('');
  });
});
