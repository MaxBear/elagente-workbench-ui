// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadComposer, type ThreadComposerProps } from './ThreadComposer';

let root: Root, host: HTMLDivElement;

async function render(props: Partial<ThreadComposerProps> = {}) {
  await act(async () =>
    root.render(<ThreadComposer activeView="chat" onSubmit={vi.fn()} {...props} />),
  );
}
const placeholder = () => host.querySelector('.thread-composer-placeholder')?.textContent ?? '';
const send = () => host.querySelector<HTMLButtonElement>('button[type="submit"]');

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

// ELA-253 UI (a): a composer the host locks during a run must not invite typing.
describe('composer run state', () => {
  it('says the agent is working, not how to send, when locked during a run', async () => {
    await render({ disabled: true, canInterrupt: true, onInterrupt: vi.fn() });
    expect(placeholder()).toBe('Working… you can send when this turn ends');
    expect(placeholder()).not.toContain('Ctrl+Enter');
    expect(host.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('false');
    expect(send()?.disabled).toBe(true);
    expect(send()?.getAttribute('data-send-intent')).toBe('send');
    expect(send()?.querySelector('.composer-send-later')).toBeNull();
    expect(send()?.getAttribute('title')).toBe('Working… you can send when this turn ends');
    // The stop control is still offered.
    expect(host.querySelector('[aria-label="Stop Current Turn"]')).not.toBeNull();
  });

  it('recognises a run without an interrupt capability from threadRunning', async () => {
    await render({ disabled: true, threadRunning: true });
    expect(placeholder()).toBe('Working… you can send when this turn ends');
  });

  it('explains other locks without the send hint', async () => {
    await render({ disabled: true, threadConnected: false });
    expect(placeholder()).toBe('Reconnecting… you can send once connected');
    act(() => root.unmount());
    root = createRoot(host);
    await render({ disabled: true });
    expect(placeholder()).toBe('Sending is unavailable right now');
    expect(send()?.getAttribute('title')).toBe('Sending is unavailable right now');
  });

  it('keeps a host-supplied disabled placeholder', async () => {
    await render({ disabled: true, canInterrupt: true, disabledPlaceholder: 'Paused by host' });
    expect(placeholder()).toBe('Paused by host');
  });

  it('keeps the queue intent and send hint when the composer stays editable during a run', async () => {
    await render({ canInterrupt: true, threadRunning: true, onInterrupt: vi.fn() });
    expect(placeholder()).toBe('Message · Ctrl+Enter to send');
    expect(host.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(send()?.getAttribute('data-send-intent')).toBe('queue');
    expect(send()?.getAttribute('aria-label')).toBe('Send after this turn');
  });
});
