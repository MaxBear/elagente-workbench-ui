/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ThreadTurnDto } from '@remote-codex/shared';

import { ThreadTimeline } from '../ThreadTimeline';

// ELA-259. A host keeps each Agent's workspace mounted in its own keyed pane and
// orders the panes by the sandbox listing, which the server sorts by
// `updated_at`. A periodic sandbox scan reorders them, React moves the pane, and
// the browser rebuilds the moved boxes: the timeline's scroll offset restarts at
// 0 without a scroll event. The reader, resting the pointer on a turn's work
// line, sees the conversation jump to its first turn.

const VIEWPORT = 1000;
const CONTENT = 5000;
const MAX_TOP = CONTENT - VIEWPORT;

const start = Date.parse('2026-10-26T20:00:00Z');
const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();

/** Fresh objects on every call, as a host projects its snapshot on every render. */
function projectTurns(): ThreadTurnDto[] {
  const turn = (index: number, status: ThreadTurnDto['status'], from: number, to: number, tools: number): ThreadTurnDto => ({
    id: `turn-${index}`,
    startedAt: at(from),
    completedAt: at(to),
    status,
    error: null,
    items: [
      { id: `prompt-${index}`, kind: 'userMessage', text: `Request ${index}` },
      ...Array.from({ length: tools }, (_, tool) => ({
        id: `tool-${index}-${tool}`, kind: 'toolCall' as const, title: 'bo_mcp.evaluate', text: `candidate ${tool}`,
        status: 'completed', createdAt: at(from + tool * 0.5), updatedAt: at(from + tool * 0.5 + 0.2),
      })),
      { id: `answer-${index}`, kind: 'agentMessage', text: `Answer ${index}`, createdAt: at(to) },
    ],
  });
  return [
    turn(1, 'completed', 0, 0.2, 1),
    turn(2, 'completed', 10, 20, 3),
    turn(3, 'completed', 30, 60, 3),
    turn(4, 'interrupted', 250, 299.65, 58),
  ];
}

function Panes({ order, hidden = false }: { order: string[]; hidden?: boolean }) {
  return (
    <section>
      {order.map((agent) => agent === 'grafico' ? (
        <div key="grafico" data-agent-pane="grafico" hidden={hidden}>
          <ThreadTimeline threadId="thr-h2" turns={projectTurns()} liveOutput="" />
        </div>
      ) : (
        <div key="estructural" data-agent-pane="estructural" hidden />
      ))}
    </section>
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let restoreDom: (() => void) | null = null;

/**
 * jsdom has no layout. The container gets a fixed viewport and content height,
 * and, like a browser, its offset restarts at 0, silently, when a subtree that
 * holds it is moved in the document. Inside a hidden pane it has no box: no
 * size and no offset.
 */
function emulateScroller(container: HTMLElement) {
  let top = 0;
  const boxless = () => Boolean(container.closest('[hidden]'));
  Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => boxless() ? 0 : VIEWPORT });
  Object.defineProperty(container, 'scrollHeight', { configurable: true, get: () => boxless() ? 0 : CONTENT });
  Object.defineProperty(container, 'scrollTop', {
    configurable: true,
    get: () => { if (boxless()) top = 0; return top; },
    set: (value: number) => { top = Math.max(0, Math.min(MAX_TOP, value)); },
  });
  const insertBefore = Node.prototype.insertBefore;
  const appendChild = Node.prototype.appendChild;
  const rebuilt = (node: Node) => { if (node.isConnected && node.contains(container)) top = 0; };
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, child: Node | null): T {
    rebuilt(node);
    return insertBefore.call(this, node, child) as T;
  };
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    rebuilt(node);
    return appendChild.call(this, node) as T;
  };
  restoreDom = () => {
    Node.prototype.insertBefore = insertBefore;
    Node.prototype.appendChild = appendChild;
  };
  return {
    /** The reader scrolls: their own input, then the browser's scroll event. */
    scrollTo(value: number) {
      container.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: value - top }));
      top = value;
      container.dispatchEvent(new Event('scroll'));
    },
  };
}

function render(order: string[], hidden = false) {
  flushSync(() => root!.render(<Panes order={order} hidden={hidden} />));
}

beforeEach(() => {
  // Simulated time for the hook's reader-input window too.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  restoreDom?.();
  restoreDom = null;
  vi.useRealTimers();
});

function mountScrolledTimeline() {
  render(['grafico', 'estructural']);
  const container = host!.querySelector<HTMLElement>('[data-testid="thread-scroll-container"]')!;
  const scroller = emulateScroller(container);
  // The opening scroll to the newest reply, now that the container has a height.
  render(['grafico', 'estructural']);
  vi.advanceTimersByTime(50);
  return { container, scroller };
}

/** The host re-renders every two seconds; at one minute its panes swap places. */
function restOneMinute(onTick?: (second: number) => void) {
  for (let second = 2; second <= 70; second += 2) {
    vi.advanceTimersByTime(2000);
    render(second >= 60 ? ['estructural', 'grafico'] : ['grafico', 'estructural']);
    onTick?.(second);
  }
}

describe('reading position when the host moves the timeline (ELA-259)', () => {
  it('keeps the reader on the interrupted turn they rest the pointer on', () => {
    const { container, scroller } = mountScrolledTimeline();
    scroller.scrollTo(2600);

    const workLine = Array.from(host!.querySelectorAll<HTMLElement>('.thread-worked-toggle')).at(-1)!;
    expect(workLine.textContent).toContain('Interrupted');
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      workLine.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'pointerenter' && type !== 'mouseenter' }));
    }

    const positions: number[] = [];
    restOneMinute(() => positions.push(container.scrollTop));

    // Moved, not remounted: the same scroller and the same work line under the pointer.
    expect(host!.querySelector('[data-agent-pane="grafico"]')?.previousElementSibling?.getAttribute('data-agent-pane')).toBe('estructural');
    expect(host!.querySelector('[data-testid="thread-scroll-container"]')).toBe(container);
    expect(workLine.isConnected).toBe(true);
    expect(Array.from(host!.querySelectorAll('.thread-worked-toggle')).at(-1)).toBe(workLine);
    // Not one tick, hover or move changed where the reader is.
    expect(new Set(positions)).toEqual(new Set([2600]));
    expect(container.scrollTop).toBe(2600);
  });

  it('keeps the reader in place when the pane is shown again after hiding', () => {
    const { container, scroller } = mountScrolledTimeline();
    scroller.scrollTo(2600);

    // Another Agent is shown for a while; this one keeps updating, hidden.
    for (let second = 2; second <= 10; second += 2) {
      vi.advanceTimersByTime(2000);
      render(['grafico', 'estructural'], true);
    }
    render(['grafico', 'estructural']);
    vi.advanceTimersByTime(2000);
    render(['grafico', 'estructural']);

    expect(host!.querySelector('[data-testid="thread-scroll-container"]')).toBe(container);
    expect(container.scrollTop).toBe(2600);
  });

  it('keeps a reader who follows the newest reply at the bottom', () => {
    const { container } = mountScrolledTimeline();
    expect(container.scrollTop).toBe(MAX_TOP);

    restOneMinute();

    expect(host!.querySelector('[data-testid="thread-scroll-container"]')).toBe(container);
    expect(container.scrollTop).toBe(MAX_TOP);
  });
});
