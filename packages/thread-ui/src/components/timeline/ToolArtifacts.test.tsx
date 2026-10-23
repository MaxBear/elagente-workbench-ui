/**
 * @vitest-environment jsdom
 */
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ThreadHistoryItemDto } from '@remote-codex/shared';

import type { ThreadTimelineAdapter, ThreadToolArtifact } from '../../adapters';
import { StructuredToolEvidence } from './StructuredToolEvidence';

// ELA-217/219: tool images (e.g. view_molecule renders) published as artifacts
// and named in progress.artifactIds appear in the tool card, not as id text.
let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  host.className = 'thread-ui-shell';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const item = (artifactIds: string[]) => ({
  id: 'tool-1', kind: 'toolCall', text: 'view_molecule',
  progress: { version: 1, callId: 'call-1', label: 'view_molecule', status: 'completed', artifactIds },
}) as unknown as ThreadHistoryItemDto;

const known: Record<string, ThreadToolArtifact> = {
  png: { id: 'png', name: 'water.png', mediaType: 'image/png', kind: 'file', url: '/agent-api/demo/artifacts/thr/png' },
  xyz: { id: 'xyz', name: 'water.xyz', mediaType: 'chemical/x-xyz', kind: 'chem.structure', url: '/agent-api/demo/artifacts/thr/xyz' },
  inline: { id: 'inline', name: 'leak.png', mediaType: 'image/png', url: 'data:image/png;base64,iVBORw0KGgo=' },
};
const adapter: ThreadTimelineAdapter = { resolveArtifact: (id) => known[id] ?? null };

function render(ids: string[], withAdapter: ThreadTimelineAdapter | undefined = adapter) {
  act(() => root!.render(<StructuredToolEvidence item={item(ids)} scrollRootRef={createRef()} adapter={withAdapter} />));
  return host!;
}

describe('tool artifacts', () => {
  it('shows an image artifact as a thumbnail that opens full size, visible while the card is folded', () => {
    const view = render(['png']);
    const figure = view.querySelector('.thread-graph-tool-artifacts [data-artifact-id="png"]')!;
    expect(figure.closest('details')).toBeNull();
    const image = figure.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(`${location.origin}/agent-api/demo/artifacts/thr/png`);
    expect(image.getAttribute('alt')).toBe('water.png');
    act(() => figure.querySelector('button')!.click());
    expect(document.querySelector('.thread-graph-image-lightbox img')?.getAttribute('src')).toBe(`${location.origin}/agent-api/demo/artifacts/thr/png`);
    expect(view.textContent).not.toContain('Full artifacts');
  });

  it('links other artifacts with name and type, and keeps unknown ids inside the folded card', () => {
    const view = render(['xyz', 'missing']);
    const link = view.querySelector<HTMLAnchorElement>('[data-artifact-id="xyz"] a')!;
    expect(link.textContent).toBe('water.xyz');
    expect(link.getAttribute('href')).toBe(`${location.origin}/agent-api/demo/artifacts/thr/xyz`);
    expect(view.querySelector('[data-artifact-id="xyz"]')!.textContent).toContain('chemical/x-xyz');
    expect(view.querySelector('[data-artifact-id="missing"]')).toBeNull();
    expect(view.querySelector('details')!.textContent).toContain('Full artifacts: missing');
  });

  it('never puts inline base64 data into the DOM', () => {
    const view = render(['inline']);
    expect(view.querySelector('img')).toBeNull();
    expect(view.innerHTML).not.toContain('base64');
    expect(view.querySelector('[data-artifact-id="inline"]')!.textContent).toContain('leak.png');
  });

  it('shows nothing outside the card when the host cannot resolve artifacts', () => {
    const view = render(['png'], {});
    expect(view.querySelector('img')).toBeNull();
    expect(view.querySelector('.thread-graph-tool-artifacts')).toBeNull();
    expect(view.querySelector('details')!.textContent).toContain('Full artifacts: png');
  });

  it('accepts same-origin and https addresses only', () => {
    known.remote = { id: 'remote', name: 'r.png', mediaType: 'image/png', url: 'http://elsewhere.example/r.png' };
    known.secure = { id: 'secure', name: 's.png', mediaType: 'image/png', url: 'https://cdn.example/s.png' };
    known.relative = { id: 'relative', name: 'p.png', mediaType: 'image/png', url: '//elsewhere.example/p.png' };
    const view = render(['remote', 'secure', 'relative']);
    expect([...view.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual(['https://cdn.example/s.png']);
    expect(view.querySelector('[data-artifact-id="remote"] a')).toBeNull();
    expect(view.querySelector('[data-artifact-id="relative"] a')).toBeNull();
    expect(view.querySelector('[data-artifact-id="png"]')).toBeNull();
  });
});
