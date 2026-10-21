// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTerminalKeyboardInset } from './useTerminalKeyboardInset';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
let viewport: EventTarget & { height: number; offsetTop: number; scale: number };
function Fixture({ enabled = true }) {
  const ref = useRef<HTMLDivElement>(null);
  const inset = useTerminalKeyboardInset(ref, enabled);
  return <div ref={ref} style={{ paddingBottom: inset }} data-testid="layout">
    <section data-testid="workbench-bottom-panel"><textarea aria-label="Terminal" /><button>Menu</button></section>
    <textarea aria-label="Chat" />
  </div>;
}
beforeEach(() => {
  vi.stubGlobal('innerHeight', 800);
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 800, height: 700 } as DOMRect);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Fixture />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const padding = () => host.querySelector<HTMLElement>('[data-testid="layout"]')!.style.paddingBottom;
function openKeyboard() {
  act(() => host.querySelector<HTMLTextAreaElement>('[aria-label="Terminal"]')!.focus());
  act(() => { viewport.height = 500; viewport.dispatchEvent(new Event('resize')); });
}
it('reserves layout space for the whole terminal when the visual viewport shrinks without browser panning', () => {
  openKeyboard(); expect(padding()).toBe('300px');
  act(() => host.querySelector('button')!.focus()); expect(padding()).toBe('300px');
  act(() => { viewport.height = 800; viewport.dispatchEvent(new Event('resize')); });
  expect(padding()).toBe('0px');
});
it('accounts for browser panning and releases space when focus changes to the chat composer', () => {
  openKeyboard();
  act(() => { viewport.offsetTop = 120; viewport.dispatchEvent(new Event('scroll')); });
  expect(padding()).toBe('180px');
  act(() => host.querySelector<HTMLTextAreaElement>('[aria-label="Chat"]')!.focus());
  expect(padding()).toBe('0px');
});
it('does not double compensate a resized layout viewport, pinch zoom, or a desktop panel', () => {
  openKeyboard();
  act(() => { vi.stubGlobal('innerHeight', 500); viewport.dispatchEvent(new Event('resize')); });
  expect(padding()).toBe('0px');
  act(() => { vi.stubGlobal('innerHeight', 800); viewport.scale = 2; viewport.dispatchEvent(new Event('resize')); });
  expect(padding()).toBe('0px');
  act(() => { viewport.scale = 1; root.render(<Fixture enabled={false} />); });
  expect(padding()).toBe('0px');
});
