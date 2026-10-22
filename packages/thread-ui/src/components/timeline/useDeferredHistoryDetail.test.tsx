/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ThreadHistoryItemDetailDto,
  ThreadHistoryItemDto,
} from '@remote-codex/shared';
import { useDeferredHistoryDetail } from './useDeferredHistoryDetail';

type HookInput = Parameters<typeof useDeferredHistoryDetail>[0];
type HookResult = ReturnType<typeof useDeferredHistoryDetail>;

let latestResult: HookResult | null = null;

function HookHarness(props: HookInput) {
  latestResult = useDeferredHistoryDetail(props);
  return null;
}

function item(
  id: string,
  kind: ThreadHistoryItemDto['kind'] = 'fileRead',
  extra: Partial<ThreadHistoryItemDto> = {},
): ThreadHistoryItemDto {
  return {
    id,
    kind,
    text: id,
    ...extra,
  };
}

function detail(
  id: string,
  kind: ThreadHistoryItemDto['kind'] = 'fileRead',
  extra: Partial<ThreadHistoryItemDetailDto> = {},
): ThreadHistoryItemDetailDto {
  return {
    id,
    kind,
    title: `${id} title`,
    text: `${id} detail`,
    ...extra,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function renderHookHarness(input: HookInput = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<HookHarness {...input} />);
  });

  return {
    rerender(nextInput: HookInput) {
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

describe('useDeferredHistoryDetail', () => {
  beforeEach(() => {
    latestResult = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestResult = null;
  });

  it('opens inline expanded text without a history item loader', () => {
    const harness = renderHookHarness();

    flushSync(() => {
      latestResult?.openExpandedText('Inline title', 'Inline body');
    });

    expect(latestResult?.expandedText).toEqual({
      title: 'Inline title',
      text: 'Inline body',
    });
    harness.unmount();
  });

  it('uses inline command detail and the selection callback when no deferred load is required', async () => {
    const onSelectHistoryItemDetail = vi.fn();
    const harness = renderHookHarness({ onSelectHistoryItemDetail });
    const command = item('cmd', 'commandExecution', {
      detailText: 'inline command output',
    }) as ThreadHistoryItemDto & { kind: 'commandExecution' };

    await latestResult?.openCommandDetail(command, 'Command Details');

    expect(latestResult?.expandedText).toBeNull();
    expect(onSelectHistoryItemDetail).toHaveBeenCalledWith({
      item: command,
      detail: {
        id: 'cmd',
        kind: 'commandExecution',
        title: 'Command Details',
        text: 'inline command output',
      },
    });
    harness.unmount();
  });

  it('shows loading, resolves deferred generic details, and reuses cache', async () => {
    const pending = deferred<ThreadHistoryItemDetailDto>();
    const loadHistoryItemDetail = vi.fn(() => pending.promise);
    const harness = renderHookHarness({ loadHistoryItemDetail });
    const fileRead = item('file', 'fileRead', { hasDeferredDetail: true });

    let openPromise: Promise<void> | undefined;
    flushSync(() => {
      openPromise = latestResult?.openDeferredHistoryItemDetail(
        fileRead,
        'File Read Details',
        'fallback',
        'loading...',
        'failed',
      );
    });

    expect(latestResult?.expandedText).toEqual({
      title: 'File Read Details',
      text: 'loading...',
    });

    pending.resolve(detail('file', 'fileRead', { text: 'loaded detail' }));
    await openPromise;
    await flushPromises();
    harness.rerender({ loadHistoryItemDetail });

    expect(latestResult?.expandedText).toEqual({
      title: 'file title',
      text: 'loaded detail',
    });

    await latestResult?.openDeferredHistoryItemDetail(
      fileRead,
      'File Read Details',
      'fallback',
      'loading...',
      'failed',
    );

    expect(loadHistoryItemDetail).toHaveBeenCalledTimes(1);
    expect(latestResult?.expandedText).toEqual({
      title: 'file title',
      text: 'loaded detail',
    });
    harness.unmount();
  });

  it('ignores stale deferred responses after the dialog is closed', async () => {
    const pending = deferred<ThreadHistoryItemDetailDto>();
    const harness = renderHookHarness({
      loadHistoryItemDetail: () => pending.promise,
    });
    const fileRead = item('file', 'fileRead', { hasDeferredDetail: true });

    flushSync(() => {
      void latestResult?.openDeferredHistoryItemDetail(
        fileRead,
        'File Read Details',
        'fallback',
        'loading...',
        'failed',
      );
    });
    expect(latestResult?.expandedText?.text).toBe('loading...');

    flushSync(() => {
      latestResult?.closeExpandedText();
    });
    pending.resolve(detail('file'));
    await flushPromises();
    flushSync(() => {});

    expect(latestResult?.expandedText).toBeNull();
    harness.unmount();
  });

  it('shows loader errors separately from tool output and allows retry', async () => {
    const loadHistoryItemDetail = vi.fn().mockRejectedValueOnce(new Error('loader exploded'))
      .mockResolvedValueOnce({ text: 'recovered details' });
    const harness = renderHookHarness({ loadHistoryItemDetail });
    const fileRead = item('file', 'fileRead', { hasDeferredDetail: true });

    await latestResult?.openDeferredHistoryItemDetail(
      fileRead,
      'File Read Details',
      'fallback',
      'loading...',
      'failed',
    );
    await flushPromises();
    harness.rerender({ loadHistoryItemDetail });

    expect(latestResult?.expandedText).toEqual({
      title: 'File Read Details',
      text: '',
      error: 'loader exploded',
      onRetry: expect.any(Function),
    });
    await latestResult?.expandedText?.onRetry?.();
    await flushPromises();
    harness.rerender({ loadHistoryItemDetail });
    expect(latestResult?.expandedText?.text).toBe('recovered details');
    expect(latestResult?.expandedText?.error).toBeUndefined();
    harness.unmount();
  });

  it('routes deferred tool call details to the selection callback without opening a loading dialog', async () => {
    const pending = deferred<ThreadHistoryItemDetailDto>();
    const onSelectHistoryItemDetail = vi.fn();
    const harness = renderHookHarness({
      loadHistoryItemDetail: () => pending.promise,
      onSelectHistoryItemDetail,
    });
    const toolCall = item('tool', 'toolCall', {
      hasDeferredDetail: true,
    }) as ThreadHistoryItemDto & { kind: 'toolCall' };

    void latestResult?.openToolCallDetail(toolCall, 'Tool Details');

    expect(latestResult?.expandedText).toBeNull();

    pending.resolve(detail('tool', 'toolCall', { text: 'loaded tool' }));
    await flushPromises();
    flushSync(() => {});

    expect(onSelectHistoryItemDetail).toHaveBeenCalledWith({
      item: toolCall,
      detail: {
        id: 'tool',
        kind: 'toolCall',
        title: 'tool title',
        text: 'loaded tool',
      },
    });
    expect(latestResult?.expandedText).toBeNull();
    harness.unmount();
  });
});
