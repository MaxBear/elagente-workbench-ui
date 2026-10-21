// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphChatMessageContent } from './GraphChatMessageContent';
import { GraphChatMermaidDiagram } from './GraphChatMermaidDiagram';
import { hasClosedMarkdownFence, isMermaidCode, renderChatMermaid } from './graphChatMermaid';

vi.mock('./graphChatMermaid', async importOriginal => ({
  ...await importOriginal<typeof import('./graphChatMermaid')>(),
  renderChatMermaid: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
const renderer = vi.mocked(renderChatMermaid);
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  renderer.mockReset().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"><text>Rendered diagram</text></svg>');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
async function render(element: ReactNode) {
  await act(async () => { root.render(element); });
}

describe('chat Mermaid diagrams', () => {
  it('renders diagram blocks in read-only chat without reinterpreting inline or program code', async () => {
    await render(<GraphChatMessageContent readOnly content={[
      '```mermaid\nsequenceDiagram\nA->>B: Hello\n```',
      '```\nflowchart TD\nA-->B\n```',
      '```flowchart\ngraph LR\nC-->D\n```',
      '`flowchart TD`',
      '```javascript\nflowchart TD\nA-->B\n```',
    ].join('\n\n')} />);
    expect(container.querySelectorAll('.thread-graph-mermaid-canvas svg')).toHaveLength(3);
    expect(container.querySelector('pre .thread-graph-mermaid')).toBeNull();
    expect(container.querySelector('code.thread-graph-inline-code')?.textContent).toBe('flowchart TD');
    expect(container.querySelectorAll('.thread-graph-code-block')).toHaveLength(1);
  });

  it('waits for the streamed fence to close, then preserves source view during unrelated updates', async () => {
    const partial = '```mermaid\nflowchart TD\nA-->B';
    await render(<GraphChatMessageContent streaming content={partial} />);
    expect(renderer).not.toHaveBeenCalled();
    expect(container.querySelector('.thread-graph-mermaid')?.getAttribute('data-state')).toBe('pending');
    await render(<GraphChatMessageContent streaming content={`${partial}\n\`\`\``} />);
    expect(container.querySelector('.thread-graph-mermaid-canvas svg')).not.toBeNull();
    const sourceButton = container.querySelector<HTMLButtonElement>('[aria-pressed]')!;
    act(() => sourceButton.click());
    await render(<GraphChatMessageContent streaming content={`${partial}\n\`\`\`\n\nMore prose`} />);
    expect(container.querySelector('.thread-graph-mermaid-source')?.textContent).toBe('flowchart TD\nA-->B');
    expect(container.querySelector('[aria-pressed]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores a stale asynchronous render after source or theme changes', async () => {
    let resolveOld!: (value: string) => void;
    renderer.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await render(<GraphChatMermaidDiagram source="graph LR; A-->B" dark={false} />);
    await render(<GraphChatMermaidDiagram source="graph LR; C-->D" dark />);
    await act(async () => resolveOld('<svg><text>Obsolete</text></svg>'));
    expect(container.textContent).toContain('Rendered diagram');
    expect(container.textContent).not.toContain('Obsolete');
    expect(container.querySelector('section')?.getAttribute('data-theme')).toBe('dark');
    expect(renderer.mock.calls[0]?.[2]?.aborted).toBe(true);
  });

  it('keeps invalid source readable and recovers on the next valid diagram', async () => {
    renderer.mockRejectedValueOnce(new Error('Syntax error'));
    await render(<GraphChatMermaidDiagram source={'flowchart TD\nA['} dark />);
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('error');
    expect(container.querySelector('code')?.textContent).toBe('flowchart TD\nA[');
    await render(<GraphChatMermaidDiagram source={'flowchart TD\nA-->B'} dark />);
    expect(container.querySelector('section')?.getAttribute('data-state')).toBe('ready');
    expect(container.querySelector('.thread-graph-mermaid-error')).toBeNull();
  });

  it('recognizes diagram headers and matching Markdown fences conservatively', () => {
    expect(isMermaidCode('', '%% explanation\nflowchart TD; A-->B')).toBe(true);
    expect(isMermaidCode('python', 'flowchart TD\nA-->B')).toBe(false);
    expect(isMermaidCode('', 'This mentions flowchart TD')).toBe(false);
    expect(hasClosedMarkdownFence('> ~~~~mermaid\n> graph LR\n> ~~~~', 1, 3)).toBe(true);
    expect(hasClosedMarkdownFence('```mermaid\ngraph LR\n~~~', 1, 3)).toBe(false);
    expect(hasClosedMarkdownFence('````mermaid\ngraph LR\n```', 1, 3)).toBe(false);
  });
});
