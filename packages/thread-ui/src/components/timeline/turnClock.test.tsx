/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatElapsedDuration, TurnClockContext, useSecondClock, type TurnClock } from './turnStatus';

const startedAt = '2026-10-22T00:14:45.000Z';
const server = Date.parse(startedAt);
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Elapsed() {
  return <span>{formatElapsedDuration(startedAt, useSecondClock(true))}</span>;
}

function render(clock: TurnClock | null) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(clock ? <TurnClockContext.Provider value={clock}><Elapsed /></TurnClockContext.Provider> : <Elapsed />));
  return host;
}

describe('running turn clock', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    // The phone's clock is 65 s ahead of the server.
    vi.setSystemTime(server + 5_000 + 65_000);
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.useRealTimers();
  });

  it('uses the host clock, not a skewed device clock, and keeps counting each second', () => {
    let serverNow = server + 5_000;
    const view = render({ now: () => serverNow });
    expect(view.textContent).toBe('5s');
    serverNow += 1_000;
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(view.textContent).toBe('6s');
  });

  it('stops at the last confirmed moment while the host cannot confirm the turn is running', () => {
    const view = render({ now: () => server + 75_000, frozenAt: server + 9_000 });
    expect(view.textContent).toBe('9s');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(view.textContent).toBe('9s');
  });

  it('keeps the device clock when no host clock is provided', () => {
    expect(render(null).textContent).toBe('1m 10s');
  });
});
