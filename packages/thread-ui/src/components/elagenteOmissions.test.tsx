/** @vitest-environment jsdom */
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { TurnTokenSummary } from './timeline/tokenFormatting';
import { ThreadToolsMenu } from './workbench/ThreadToolsMenu';
import { TokenUsageCost } from './timeline/TokenUsageCost';
import { isCopyableWorkspacePath } from './WorkbenchPath';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ElAgente host adaptations: what an Agent does not report is omitted, not shown as a placeholder.
describe('honest omission', () => {
  it('shows no turn price summary when the Agent reports neither tokens nor a price', () => {
    const html = renderToStaticMarkup(<TurnTokenSummary turn={{ id: 't', status: 'completed', startedAt: '2026-10-21T00:00:00Z', completedAt: '2026-10-21T00:00:01Z', error: null, items: [] } as never} />);
    expect(html).toBe('');
  });

  it('shows no price badge for token usage without a price', () => {
    const turn = { id: 't', status: 'completed', startedAt: '2026-10-21T00:00:00Z', completedAt: '2026-10-21T00:00:01Z', error: null, items: [],
      tokenUsage: { total: { totalTokens: 120, inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 0 }, last: null, modelContextWindow: null } };
    expect(renderToStaticMarkup(<TurnTokenSummary turn={turn as never} />)).toBe('');
    expect(renderToStaticMarkup(<TokenUsageCost usage={turn.tokenUsage.total as never} price={null as never} />)).toBe('');
  });

  it('copies only real filesystem workspace paths', () => {
    for (const path of ['/home/u/work', '~/work', 'C:\\work', 'D:/data']) expect(isCopyableWorkspacePath(path)).toBe(true);
    for (const path of ['', 'Grafico', 'ElAgente', 'artifacts:', null, undefined]) expect(isCopyableWorkspacePath(path)).toBe(false);
  });

  it.each(['', 'Grafico'])('shows no path chip or shortcut star without a real path (%j) or shortcuts', async (workspacePath) => {
    const host = document.createElement('div');
    host.className = 'thread-ui-shell';
    document.body.append(host);
    const anchor = createRef<HTMLButtonElement>();
    const root = createRoot(host);
    await act(async () => root.render(<>
      <button ref={anchor} type="button">tools</button>
      <ThreadToolsMenu id="m" open anchorRef={anchor} path={workspacePath} title="Benzene" favorite={false} onClose={() => {}}><button type="button" aria-label="Share">s</button></ThreadToolsMenu>
    </>));
    expect(document.querySelector('.matter-thread-tools-path')).toBeNull();
    expect(document.querySelector('.matter-thread-tools-star')).toBeNull();
    expect(document.querySelector('.matter-thread-tools-title')?.textContent).toBe('Benzene');
    await act(async () => root.unmount());
    host.remove();
  });
});
