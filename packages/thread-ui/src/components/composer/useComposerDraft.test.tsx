/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptAttachmentUpload } from '../../types';
import {
  DRAFT_SYNC_DELAY_MS,
  useComposerDraft,
  type UseComposerDraftInput,
  type UseComposerDraftResult,
} from './useComposerDraft';

type HostDraft = {
  prompt: string;
  attachments: PromptAttachmentUpload[];
};

let latestResult: UseComposerDraftResult | null = null;

function HookHarness(props: UseComposerDraftInput) {
  latestResult = useComposerDraft(props);
  return null;
}

function applyHostUpdate(
  current: HostDraft,
  update: Parameters<NonNullable<UseComposerDraftInput['onDraftChange']>>[0],
) {
  return typeof update === 'function' ? update(current) : update;
}

function renderHookHarness(input: UseComposerDraftInput) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<HookHarness {...input} />);
  });

  return {
    rerender(nextInput: UseComposerDraftInput) {
      flushSync(() => {
        root.render(<HookHarness {...nextInput} />);
      });
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useComposerDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    latestResult = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    latestResult = null;
  });

  it('updates local draft without notifying a host when uncontrolled', () => {
    const onDraftChange = vi.fn();
    const harness = renderHookHarness({
      isShellView: false,
      onDraftChange,
    });

    flushSync(() => {
      latestResult?.updateDraft(() => ({
        prompt: 'local text',
        attachments: [],
      }));
    });

    expect(latestResult?.isDraftControlled).toBe(false);
    expect(latestResult?.prompt).toBe('local text');
    expect(onDraftChange).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('sends immediate controlled draft updates to the host once', () => {
    let hostDraft: HostDraft = { prompt: 'host', attachments: [] };
    const onDraftChange = vi.fn((update) => {
      hostDraft = applyHostUpdate(hostDraft, update);
    });
    const harness = renderHookHarness({
      isShellView: false,
      draftPrompt: hostDraft.prompt,
      draftAttachments: hostDraft.attachments,
      onDraftChange,
    });

    flushSync(() => {
      latestResult?.updateDraft(() => ({
        prompt: 'next',
        attachments: [],
      }));
    });

    expect(latestResult?.isDraftControlled).toBe(true);
    expect(latestResult?.prompt).toBe('next');
    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(hostDraft).toEqual({ prompt: 'next', attachments: [] });

    flushSync(() => {
      latestResult?.flushControlledDraftToHost();
    });

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    harness.unmount();
  });

  it('defers controlled host sync and coalesces multiple local edits', () => {
    let hostDraft: HostDraft = { prompt: 'host', attachments: [] };
    const onDraftChange = vi.fn((update) => {
      hostDraft = applyHostUpdate(hostDraft, update);
    });
    const harness = renderHookHarness({
      isShellView: false,
      draftPrompt: hostDraft.prompt,
      draftAttachments: hostDraft.attachments,
      onDraftChange,
    });

    flushSync(() => {
      latestResult?.updateDraft(() => ({
        prompt: 'first',
        attachments: [],
      }), 'deferred');
      latestResult?.updateDraft(() => ({
        prompt: 'second',
        attachments: [],
      }), 'deferred');
    });

    expect(latestResult?.prompt).toBe('second');
    expect(onDraftChange).not.toHaveBeenCalled();

    flushSync(() => {
      vi.advanceTimersByTime(DRAFT_SYNC_DELAY_MS - 1);
    });
    expect(onDraftChange).not.toHaveBeenCalled();

    flushSync(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(hostDraft).toEqual({ prompt: 'second', attachments: [] });
    harness.unmount();
  });

  it('flushes a deferred controlled draft immediately and clears the pending timer', () => {
    let hostDraft: HostDraft = { prompt: 'host', attachments: [] };
    const onDraftChange = vi.fn((update) => {
      hostDraft = applyHostUpdate(hostDraft, update);
    });
    const harness = renderHookHarness({
      isShellView: false,
      draftPrompt: hostDraft.prompt,
      draftAttachments: hostDraft.attachments,
      onDraftChange,
    });

    flushSync(() => {
      latestResult?.updateDraft(() => ({
        prompt: 'pending',
        attachments: [],
      }), 'deferred');
      latestResult?.flushControlledDraftToHost();
    });

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(hostDraft).toEqual({ prompt: 'pending', attachments: [] });

    flushSync(() => {
      vi.advanceTimersByTime(DRAFT_SYNC_DELAY_MS);
    });
    expect(onDraftChange).toHaveBeenCalledTimes(1);
    harness.unmount();
  });

  it('accepts host draft refreshes without echoing them back', () => {
    const onDraftChange = vi.fn();
    const hostDraft: HostDraft = { prompt: 'host', attachments: [] };
    const harness = renderHookHarness({
      isShellView: false,
      draftPrompt: hostDraft.prompt,
      draftAttachments: hostDraft.attachments,
      onDraftChange,
    });

    harness.rerender({
      isShellView: false,
      draftPrompt: 'host refresh',
      draftAttachments: [],
      onDraftChange,
    });

    expect(latestResult?.prompt).toBe('host refresh');
    expect(onDraftChange).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('does not let a delayed host echo overwrite newer dictation or cancel its persistence', () => {
    const onDraftChange = vi.fn();
    const input = { isShellView: false, draftPrompt: '', draftAttachments: [], onDraftChange };
    const harness = renderHookHarness(input);
    flushSync(() => {
      latestResult?.updateDraft(() => ({ prompt: 'first phrase', attachments: [] }));
      latestResult?.updateDraft(() => ({ prompt: 'first phrase corrected', attachments: [] }), 'deferred');
    });
    harness.rerender({ ...input, draftPrompt: 'first phrase' });
    expect(latestResult?.prompt).toBe('first phrase corrected');
    flushSync(() => { vi.advanceTimersByTime(DRAFT_SYNC_DELAY_MS); });
    expect(onDraftChange).toHaveBeenCalledTimes(2);
    const sent = applyHostUpdate({ prompt: '', attachments: [] }, onDraftChange.mock.calls[1]![0]);
    expect(sent.prompt).toBe('first phrase corrected');
    harness.rerender({ ...input, draftPrompt: 'first phrase corrected' });
    expect(latestResult?.prompt).toBe('first phrase corrected');
    harness.unmount();
  });

  it('preserves newer text and File objects when the host clears an accepted in-flight submission', () => {
    const onDraftChange = vi.fn();
    const input = { isShellView: false, draftPrompt: 'sent text', draftAttachments: [], onDraftChange };
    const harness = renderHookHarness(input);
    const submission = latestResult!.captureSubmission({ prompt: 'sent text', attachments: [] });
    const file = new File(['next attachment'], 'next.txt', { type: 'text/plain' });
    const attachment = { clientId: 'next-file', kind: 'file' as const, placeholder: '[FILE next-file]', originalName: 'next.txt', file };
    flushSync(() => {
      latestResult!.updateDraft(() => ({ prompt: '新草稿\n第二行', attachments: [attachment] }), 'deferred');
    });
    harness.rerender({ ...input, draftPrompt: '' });
    flushSync(() => submission.complete());
    expect(latestResult!.prompt).toBe('新草稿\n第二行');
    expect(latestResult!.attachments[0]!.file).toBe(file);
    const restored = applyHostUpdate({ prompt: '', attachments: [] }, onDraftChange.mock.calls.at(-1)![0]);
    expect(restored.prompt).toBe('新草稿\n第二行');
    expect(restored.attachments[0]!.file).toBe(file);
    harness.unmount();
  });

  it('clears only an unchanged submitted snapshot and preserves a rejected draft', () => {
    const harness = renderHookHarness({ isShellView: false });
    flushSync(() => latestResult!.updateDraft(() => ({ prompt: 'first', attachments: [] })));
    const first = latestResult!.captureSubmission({ prompt: 'first', attachments: [] });
    flushSync(() => first.complete());
    expect(latestResult!.prompt).toBe('');
    flushSync(() => latestResult!.updateDraft(() => ({ prompt: 'retry', attachments: [] })));
    latestResult!.captureSubmission({ prompt: 'retry', attachments: [] }).cancel();
    expect(latestResult!.prompt).toBe('retry');
    const second = latestResult!.captureSubmission({ prompt: 'retry', attachments: [] });
    flushSync(() => latestResult!.updateDraft(() => ({ prompt: 'next draft', attachments: [] })));
    flushSync(() => second.complete());
    expect(latestResult!.prompt).toBe('next draft');
    harness.unmount();
  });

  it('treats shell mode as uncontrolled even when host draft props are present', () => {
    const onDraftChange = vi.fn();
    const harness = renderHookHarness({
      isShellView: true,
      draftPrompt: 'host',
      draftAttachments: [],
      onDraftChange,
    });

    flushSync(() => {
      latestResult?.updateDraft(() => ({
        prompt: 'shell local',
        attachments: [],
      }));
    });

    expect(latestResult?.isDraftControlled).toBe(false);
    expect(latestResult?.prompt).toBe('shell local');
    expect(onDraftChange).not.toHaveBeenCalled();
    harness.unmount();
  });
});
