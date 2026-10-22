/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

import { PlaygroundApp } from './PlaygroundApp';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

class FakeTerminal {
  cols = 100;
  rows = 30;
  writes: string[] = [];
  private host: HTMLElement | null = null;

  constructor() {}

  loadAddon() {}

  open(hostElement: HTMLElement) {
    this.host = hostElement;
    hostElement.innerHTML = '<div class="xterm-rows"><div></div></div>';
  }

  attachCustomKeyEventHandler() {}

  onData() {
    return {
      dispose() {},
    };
  }

  write(value: string) {
    this.writes.push(value);
    if (this.host) {
      this.host.textContent = `${this.host.textContent ?? ''}${value}`;
    }
  }

  reset() {
    this.writes.push('reset');
    if (this.host) {
      this.host.textContent = '';
    }
  }

  scrollToBottom() {}

  focus() {}

  dispose() {}
}

class FakeFitAddon {
  fit() {}
}

vi.mock('xterm', () => ({
  Terminal: FakeTerminal,
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: FakeFitAddon,
}));

function installBrowserMocks() {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: IntersectionObserverMock,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: IntersectionObserverMock,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null),
  });

  URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
  URL.revokeObjectURL = vi.fn();
}

function textContent() {
  return host?.textContent ?? '';
}

function documentTextContent() {
  return document.body.textContent ?? '';
}

function setElementScrollGeometry(
  element: HTMLElement,
  {
    scrollHeight,
    clientHeight,
    scrollTop,
  }: {
    scrollHeight: number;
    clientHeight: number;
    scrollTop: number;
  },
) {
  Object.defineProperties(element, {
    scrollHeight: {
      configurable: true,
      value: scrollHeight,
    },
    clientHeight: {
      configurable: true,
      value: clientHeight,
    },
    scrollTop: {
      configurable: true,
      writable: true,
      value: scrollTop,
    },
  });
}

describe('playground smoke', () => {
  beforeEach(() => {
    installBrowserMocks();
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    root = null;
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it('renders the thread UI, opens the slash menu, and attaches the mocked shell', async () => {
    flushSync(() => {
      root?.render(<PlaygroundApp />);
    });

    expect(textContent()).toContain('Safety review for Grignard setup');
    expect(textContent()).toContain('The main risks are ether vapor ignition');
    await vi.waitFor(() => {
      expect(host?.querySelector('[data-testid="chat-composer"]')).not.toBeNull();
      expect(
        host?.querySelector('[data-testid="chat-panel"]'),
      ).not.toBeNull();
    });

    const slashButton = host?.querySelector<HTMLButtonElement>(
      'button[aria-label="Open slash toolbox"]',
    );
    expect(slashButton).not.toBeNull();

    flushSync(() => {
      slashButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(textContent()).toContain(
      'No tool shortcuts are configured for this thread.',
    );

    const shellButton = Array.from(
      host?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((button) => button.textContent?.includes('Open Shell'));
    expect(shellButton).not.toBeNull();

    flushSync(() => {
      shellButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(textContent()).toContain('No live shell process');
    });
    const newShellButton = Array.from(
      host?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((button) => button.textContent?.includes('New Shell'));
    expect(newShellButton).not.toBeNull();
    await vi.waitFor(() => {
      expect(newShellButton?.disabled).toBe(false);
    });

    flushSync(() => {
      newShellButton?.click();
    });

    await vi.waitFor(() => {
      expect(textContent()).toContain('Playground shell');
    });
    expect(textContent()).toContain('1 live');
    expect(textContent()).toContain('Running · computational-chemistry');
  });

  it('updates the jump-to-latest state from timeline scroll geometry', async () => {
    flushSync(() => {
      root?.render(<PlaygroundApp />);
    });

    let scrollContainer: HTMLElement | null | undefined = null;
    let tailSentinel: HTMLElement | null | undefined = null;
    let jumpButton: HTMLButtonElement | null | undefined = null;

    await vi.waitFor(() => {
      scrollContainer = host?.querySelector<HTMLElement>(
        '[data-testid="thread-scroll-container"]',
      );
      tailSentinel =
        scrollContainer?.querySelector<HTMLElement>('[aria-hidden="true"].h-px.w-full');
      jumpButton = host?.querySelector<HTMLButtonElement>(
        'button[aria-label="Jump to latest"]',
      );
      expect(scrollContainer).not.toBeNull();
      expect(tailSentinel).not.toBeNull();
      expect(jumpButton).not.toBeNull();
    });

    setElementScrollGeometry(scrollContainer!, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 900,
    });
    vi.spyOn(scrollContainer!, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 300,
      top: 0,
      right: 800,
      bottom: 300,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const tailRectSpy = vi.spyOn(tailSentinel!, 'getBoundingClientRect');
    tailRectSpy.mockReturnValue({
      width: 800,
      height: 1,
      top: 299,
      right: 800,
      bottom: 300,
      left: 0,
      x: 0,
      y: 299,
      toJSON: () => ({}),
    });

    flushSync(() => {
      scrollContainer?.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(
        jumpButton?.closest('.thread-jump-latest-badge')?.className,
      ).toContain('is-active');
    });

    scrollContainer!.scrollTop = 200;
    tailRectSpy.mockReturnValue({
      width: 800,
      height: 1,
      top: 1000,
      right: 800,
      bottom: 1001,
      left: 0,
      x: 0,
      y: 1000,
      toJSON: () => ({}),
    });

    flushSync(() => {
      scrollContainer?.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(
        jumpButton?.closest('.thread-jump-latest-badge')?.className,
      ).not.toContain('is-active');
    });

    flushSync(() => {
      jumpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(
        jumpButton?.closest('.thread-jump-latest-badge')?.className,
      ).toContain('is-active');
    });
  });

  it('opens the thread actions panel from the playground surface', async () => {
    flushSync(() => {
      root?.render(<PlaygroundApp />);
    });

    const actionsButton = host?.querySelector<HTMLButtonElement>(
      'button[aria-label="Thread actions"]',
    );
    expect(actionsButton).not.toBeNull();

    flushSync(() => {
      actionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const actionsDialog = document.body.querySelector<HTMLDivElement>(
      '[role="dialog"][aria-label="Thread actions"]',
    );
    expect(actionsDialog).not.toBeNull();
    expect(actionsDialog?.textContent).toContain('Share & export');
    expect(actionsDialog?.textContent).toContain('Latest 10');
    expect(actionsDialog?.textContent).toContain('Export HTML');
    expect(documentTextContent()).not.toContain(
      'Exports the latest 10 turns in chronological order.',
    );

    const shareTab = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent === 'People');
    expect(shareTab).not.toBeNull();

    flushSync(() => {
      shareTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(documentTextContent()).toContain('Invite someone');
    expect(
      document.body.querySelector('input[placeholder="username or email"]'),
    ).not.toBeNull();
    expect(documentTextContent()).toContain('View only');
    expect(documentTextContent()).toContain('Collaborator');
    expect(documentTextContent()).toContain('alice');
    expect(documentTextContent()).toContain('Workspace read');
  });
});
