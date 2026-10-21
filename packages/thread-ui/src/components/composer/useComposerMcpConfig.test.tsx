/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { setLocale } from '../../i18n';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useComposerMcpConfig,
  type UseComposerMcpConfigResult,
} from './useComposerMcpConfig';

let latestResult: UseComposerMcpConfigResult | null = null;

function hostFile(content: string, path = '/repo/config.toml') {
  return {
    name: 'codex.toml',
    path,
    exists: true,
    content,
  };
}

function HookHarness(
  props: Parameters<typeof useComposerMcpConfig>[0],
) {
  latestResult = useComposerMcpConfig(props);
  return null;
}

function renderHookHarness(
  input: Partial<Parameters<typeof useComposerMcpConfig>[0]> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const setMcpPanelMode = input.setMcpPanelMode ?? vi.fn();
  const props: Parameters<typeof useComposerMcpConfig>[0] = {
    hostConfigFilesAvailable: true,
    setMcpPanelMode,
    ...input,
  };

  flushSync(() => {
    root.render(<HookHarness {...props} />);
  });

  return {
    setMcpPanelMode,
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function runAsyncAction(action: () => Promise<void> | undefined) {
  let actionPromise: Promise<void> | undefined;
  flushSync(() => {
    actionPromise = action();
  });

  await actionPromise;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  flushSync(() => {});
}

describe('useComposerMcpConfig', () => {
  beforeEach(() => {
    latestResult = null;
    setLocale('en', false);
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestResult = null;
    setLocale('en', false);
    vi.restoreAllMocks();
  });

  it('uses the current language for new saves after import and retains prior notices', async () => {
    const onReadProviderConfig = vi.fn(() => hostFile(''));
    const onWriteProviderConfig = vi.fn((content: string) => hostFile(content));
    const harness = renderHookHarness({ onReadProviderConfig, onWriteProviderConfig });
    try {
      act(() => latestResult?.setMcpRawBlock('[mcp_servers.docs]\ncommand = "node"\n'));
      await act(async () => { await latestResult?.saveRawMcpBlock(); });
      const englishNotice = latestResult?.mcpConfigSuccess;
      expect(englishNotice).toContain('MCP entry written');
      act(() => setLocale('zh-CN', false));
      expect(latestResult?.mcpConfigSuccess).toBe(englishNotice);
      await act(async () => { await latestResult?.saveRawMcpBlock(); });
      expect(latestResult?.mcpConfigSuccess).toContain('MCP');
      expect(latestResult?.mcpConfigSuccess).not.toBe(englishNotice);
      expect(latestResult?.mcpConfigSuccess).toContain('已写入');
      act(() => {
        latestResult?.setMcpHttpName('docs');
        latestResult?.setMcpHttpUrl('https://example.test/mcp');
      });
      await act(async () => { await latestResult?.saveHttpMcp(); });
      expect(latestResult?.mcpConfigSuccess).toContain('已写入');
      expect(onWriteProviderConfig).toHaveBeenLastCalledWith('[mcp_servers.docs]\nurl = "https://example.test/mcp"\n');
    } finally { harness.unmount(); }
  });

  it('rejects invalid HTTP MCP names and URLs before reading provider config', async () => {
    const onReadProviderConfig = vi.fn();
    const harness = renderHookHarness({ onReadProviderConfig });

    flushSync(() => {
      latestResult?.setMcpHttpName('bad name');
      latestResult?.setMcpHttpUrl('https://example.test/mcp');
    });
    await runAsyncAction(() => latestResult?.saveHttpMcp());

    expect(onReadProviderConfig).not.toHaveBeenCalled();
    expect(latestResult?.mcpConfigError).toBe(
      'MCP name must use only letters, numbers, underscore, or hyphen.',
    );

    flushSync(() => {
      latestResult?.setMcpHttpName('docs');
      latestResult?.setMcpHttpUrl('example.test/mcp');
    });
    await runAsyncAction(() => latestResult?.saveHttpMcp());

    expect(onReadProviderConfig).not.toHaveBeenCalled();
    expect(latestResult?.mcpConfigError).toBe(
      'HTTP MCP URL must start with http:// or https://',
    );
    harness.unmount();
  });

  it('writes an HTTP MCP block, clears the form, and refreshes MCP state', async () => {
    const onReadProviderConfig = vi.fn(() => hostFile(''));
    const onWriteProviderConfig = vi.fn((content: string) => ({
      ...hostFile(content),
    }));
    const onOpenMcp = vi.fn();
    const harness = renderHookHarness({
      onReadProviderConfig,
      onWriteProviderConfig,
      onOpenMcp,
    });

    flushSync(() => {
      latestResult?.setMcpHttpName('docs');
      latestResult?.setMcpHttpUrl(' https://example.test/mcp ');
    });
    await runAsyncAction(() => latestResult?.saveHttpMcp());

    expect(onWriteProviderConfig).toHaveBeenCalledWith(
      '[mcp_servers.docs]\nurl = "https://example.test/mcp"\n',
    );
    expect(harness.setMcpPanelMode).toHaveBeenCalledWith('list');
    expect(onOpenMcp).toHaveBeenCalled();
    expect(latestResult?.mcpHttpName).toBe('');
    expect(latestResult?.mcpHttpUrl).toBe('');
    expect(latestResult?.mcpConfigPath).toBe('/repo/config.toml');
    expect(latestResult?.mcpConfigSuccess).toContain('MCP entry written');
    harness.unmount();
  });

  it('prepares the raw MCP block from provider config and preserves an existing draft', async () => {
    const onReadProviderConfig = vi.fn(() =>
      hostFile('[mcp_servers.existing]\ncommand = "node"\n'),
    );
    const harness = renderHookHarness({ onReadProviderConfig });

    await runAsyncAction(() => latestResult?.prepareRawMcpBlock());

    expect(latestResult?.mcpRawBlock).toContain('[mcp_servers.example_stdio]');
    expect(latestResult?.mcpConfigPath).toBe('/repo/config.toml');
    expect(harness.setMcpPanelMode).toHaveBeenCalledWith('stdio');

    flushSync(() => {
      latestResult?.setMcpRawBlock('[mcp_servers.custom]\ncommand = "node"\n');
    });
    await runAsyncAction(() => latestResult?.prepareRawMcpBlock());

    expect(latestResult?.mcpRawBlock).toBe(
      '[mcp_servers.custom]\ncommand = "node"\n',
    );
    harness.unmount();
  });

  it('reports provider config load failures when raw preparation is unavailable', async () => {
    const harness = renderHookHarness({
      hostConfigFilesAvailable: false,
    });

    await runAsyncAction(() => latestResult?.prepareRawMcpBlock());

    expect(latestResult?.mcpConfigBusy).toBe(false);
    expect(latestResult?.mcpConfigError).toBe(
      'Provider config editing is unavailable for this thread.',
    );
    harness.unmount();
  });

  it('writes a raw MCP block and rejects malformed raw blocks', async () => {
    const onReadProviderConfig = vi.fn(() =>
      hostFile('[other]\nvalue = true\n'),
    );
    const onWriteProviderConfig = vi.fn((content: string) => ({
      ...hostFile(content),
    }));
    const harness = renderHookHarness({
      onReadProviderConfig,
      onWriteProviderConfig,
    });

    flushSync(() => {
      latestResult?.setMcpRawBlock('command = "node"\n');
    });
    await runAsyncAction(() => latestResult?.saveRawMcpBlock());

    expect(onReadProviderConfig).not.toHaveBeenCalled();
    expect(latestResult?.mcpConfigError).toBe(
      'The raw MCP block must start with a header like [mcp_servers.name].',
    );

    flushSync(() => {
      latestResult?.setMcpRawBlock('[mcp_servers.raw]\ncommand = "node"\n');
    });
    await runAsyncAction(() => latestResult?.saveRawMcpBlock());

    expect(onWriteProviderConfig).toHaveBeenCalledWith(
      '[other]\nvalue = true\n\n[mcp_servers.raw]\ncommand = "node"\n',
    );
    expect(harness.setMcpPanelMode).toHaveBeenCalledWith('list');
    expect(latestResult?.mcpConfigSuccess).toContain('MCP entry written');
    harness.unmount();
  });
});
