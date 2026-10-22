import { useEffect, useMemo, useState } from 'react';
import type {
  ExportThreadTranscriptInput,
  ShellEventEnvelope,
  ThreadShellStateDto,
} from '@remote-codex/shared';
import type {
  AppShellNavContextValue,
  ThreadDetailUiAdapter,
  ThreadShellAdapter,
  ThreadShellControlState,
  ThreadWorkspaceAdapter,
  ThemeMode,
} from '@remote-codex/thread-ui';
import {
  AppShellMenuButton,
  AppShellNavContext,
  AppShellNavigationMenu,
  PluginProvider,
  ThreadActionsDialog,
  ThreadDetailSurface,
} from '@remote-codex/thread-ui';

import {
  mockCapabilities,
  mockDetail,
  mockStatus,
  mockThreads,
} from './mockData';
import { builtinFrontendPlugins } from '@remote-codex/thread-ui/builtin-plugins';
import { usePlaygroundModelPolicy } from './modelPolicyFixture';

const mockShellSession = {
  id: 'shell-playground-1',
  threadId: mockDetail.thread.id,
  workspaceId: mockDetail.workspace.id,
  label: 'Playground shell',
  tmuxSessionName: 'tmux-playground-1',
  backend: 'pty' as const,
  cwd: mockDetail.workspace.absPath,
  status: 'running' as const,
  attachedViewerId: null,
  createdAt: '2026-06-08T14:19:00.000Z',
  updatedAt: '2026-06-08T14:19:00.000Z',
  lastActivityAt: null,
};

const mockExportTurnsState = {
  status: 'ready' as const,
  error: null,
  data: {
    totalTurnCount: 4,
    turns: [
      {
        turnId: 'playground-turn-4',
        turnNumber: 4,
        startedAt: '2026-06-08T14:22:00.000Z',
        status: 'completed' as const,
        userPromptPreview: 'Summarize the safety plan',
      },
      {
        turnId: 'playground-turn-3',
        turnNumber: 3,
        startedAt: '2026-06-08T14:20:00.000Z',
        status: 'completed' as const,
        userPromptPreview: 'Check the solvent notes',
      },
      {
        turnId: 'playground-turn-2',
        turnNumber: 2,
        startedAt: '2026-06-08T14:18:00.000Z',
        status: 'completed' as const,
        userPromptPreview: 'Inspect the workspace artifacts',
      },
      {
        turnId: 'playground-turn-1',
        turnNumber: 1,
        startedAt: '2026-06-08T14:16:00.000Z',
        status: 'failed' as const,
        userPromptPreview: 'Review Grignard setup risks',
      },
    ],
  },
};

function mockShellState(
  shells: (typeof mockShellSession)[],
): ThreadShellStateDto {
  return {
    threadId: mockDetail.thread.id,
    workspaceId: mockDetail.workspace.id,
    state: shells[0]?.status ?? 'not_created',
    shell: shells[0] ?? null,
    shells,
    activeShellId: shells[0]?.id ?? null,
    workspacePathStatus: 'present',
  };
}

function createPlaygroundShellAdapter(): ThreadShellAdapter {
  return {
    async fetchState() {
      return mockShellState([]);
    },
    async createShell() {
      return mockShellState([mockShellSession]);
    },
    async terminateShell() {
      return {
        ...mockShellSession,
        status: 'exited',
      };
    },
    async updateShell(_shellId, input) {
      return {
        ...mockShellSession,
        label: input.label ?? mockShellSession.label,
      };
    },
    connectSocket(handlers) {
      const socket = new EventTarget() as WebSocket;
      Object.defineProperty(socket, 'readyState', {
        configurable: true,
        value: WebSocket.OPEN,
      });
      Object.defineProperty(socket, 'close', {
        configurable: true,
        value: () => {
          socket.dispatchEvent(new Event('close'));
        },
      });
      window.setTimeout(() => {
        handlers.onConnected?.({});
      }, 0);

      return {
        socket,
        send(message) {
          if (
            typeof message === 'object' &&
            message !== null &&
            'type' in message &&
            message.type === 'shell.attach'
          ) {
            window.setTimeout(() => {
              const connectedEvent: ShellEventEnvelope = {
                type: 'shell.connected',
                shellId: mockShellSession.id,
                timestamp: new Date('2026-06-08T14:19:01.000Z').toISOString(),
                payload: {
                  viewerId: 'playground-viewer-1',
                },
              };
              handlers.onShellEvent?.(connectedEvent);
              handlers.onShellEvent?.({
                type: 'shell.output',
                shellId: mockShellSession.id,
                timestamp: new Date('2026-06-08T14:19:02.000Z').toISOString(),
                payload: {
                  data: 'playground shell ready\n',
                  cwdBaseName: 'computational-chemistry',
                  isCommandRunning: false,
                },
              });
            }, 0);
          }
        },
        close() {
          socket.dispatchEvent(new Event('close'));
        },
      };
    },
  };
}

function createLargeWorkspaceAdapter(): ThreadWorkspaceAdapter {
  const contentByPath = new Map<string, string>();
  const children = Array.from({ length: 10_000 }, (_, index) => {
    const name = `generated-file-${String(index + 1).padStart(5, '0')}.ts`;
    return {
      name,
      path: name,
      kind: 'file' as const,
      size: 48,
    };
  });
  return {
    async listTree() {
      return {
        name: 'Large workspace fixture',
        path: '',
        kind: 'directory',
        childrenLoaded: true,
        hasChildren: true,
        children,
      };
    },
    async readFile({ path }) {
      const content =
        contentByPath.get(path) ??
        `export const fixturePath = ${JSON.stringify(path)};\n`;
      return {
        path,
        name: path,
        content,
        language: 'typescript',
        size: content.length,
        truncated: false,
        nextOffset: content.length,
      };
    },
    async writeFile({ path, content }) {
      contentByPath.set(path, content);
    },
  };
}

export function PlaygroundApp() {
  const playgroundParams = new URLSearchParams(window.location.search);
  const largeWorkspace = playgroundParams.has('largeWorkspace');
  const modelPolicy = usePlaygroundModelPolicy(playgroundParams);
  const [playgroundThemeMode, setPlaygroundThemeMode] = useState<ThemeMode>(
    () => {
      const queryTheme = playgroundParams.get('theme');
      if (queryTheme === 'light' || queryTheme === 'dark') return queryTheme;

      const savedTheme = window.localStorage.getItem('workbench-theme-mode');
      return savedTheme === 'light' || savedTheme === 'system'
        ? savedTheme
        : 'dark';
    },
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const playgroundTheme =
    playgroundThemeMode === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : playgroundThemeMode;
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threadActionsOpen, setThreadActionsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'shell'>('chat');
  const [followTail, setFollowTail] = useState(true);
  const [autoCollapseCompletedTurns, setAutoCollapseCompletedTurns] =
    useState(true);
  const [scrollRequestKey, setScrollRequestKey] = useState(0);
  const [shellState, setShellState] = useState<ThreadShellControlState | null>(
    null,
  );
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('workbench-theme-mode', playgroundThemeMode);

    const root = document.documentElement;
    root.dataset.themeEffective = playgroundTheme;
    root.style.colorScheme = playgroundTheme;

    const shell = document.querySelector<HTMLElement>('.thread-ui-shell');
    const shellThemeBackground = shell
      ? window.getComputedStyle(shell).getPropertyValue('--theme-bg').trim()
      : '';
    const background =
      shellThemeBackground || (playgroundTheme === 'dark' ? '#0a0f1f' : '#fff');
    document.body.style.backgroundColor = background;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', background);
  }, [playgroundTheme, playgroundThemeMode]);

  const adapter = useMemo<ThreadDetailUiAdapter>(
    () => ({
      openThread() {},
      getThreadHref(threadId) {
        return `#${threadId}`;
      },
      getNewThreadHref(workspaceId) {
        return `#new-${workspaceId ?? 'workspace'}`;
      },
      sendPrompt(input) {
        setLastSubmittedPrompt(input.prompt);
      },
      interrupt() {},
      compact() {},
      updateSettings() {},
      loadHistoryItemDetail(itemId) {
        return {
          id: itemId,
          kind: 'toolCall',
          title: 'Deferred detail',
          text: 'This is mock deferred detail for the standalone playground.',
        };
      },
      shell: createPlaygroundShellAdapter(),
      ...(largeWorkspace ? { workspace: createLargeWorkspaceAdapter() } : {}),
    }),
    [largeWorkspace],
  );

  const navContext = useMemo<AppShellNavContextValue>(
    () => ({
      navOpen: menuOpen,
      openNav: () => setMenuOpen(true),
      toggleNav: () => setMenuOpen((current) => !current),
      closeNav: () => setMenuOpen(false),
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      themeMode: playgroundThemeMode,
      setThemeMode: setPlaygroundThemeMode,
      effectiveTheme: playgroundTheme,
      defaultBackend: 'codex',
      setDefaultBackend: () => {},
      autoCollapseCompletedTurns,
      setAutoCollapseCompletedTurns,
    }),
    [
      autoCollapseCompletedTurns,
      menuOpen,
      playgroundTheme,
      playgroundThemeMode,
      settingsOpen,
    ],
  );

  const threadActionsButton = (
    <button
      type="button"
      aria-label="Thread actions"
      title="Thread actions"
      className="thread-icon-button h-10 w-10 shrink-0 rounded-full text-sm font-semibold"
      onClick={() => setThreadActionsOpen(true)}
    >
      ...
    </button>
  );

  return (
    <AppShellNavContext.Provider value={navContext}>
      <PluginProvider builtinPlugins={builtinFrontendPlugins}>
        <ThreadDetailSurface
          threads={mockThreads}
          detail={mockDetail}
          loading={false}
          error={null}
          status={mockStatus}
          capabilities={mockCapabilities}
          adapter={adapter}
          currentThreadId={mockDetail.thread.id}
          currentWorkspaceId={mockDetail.workspace.id}
          currentWorkspaceLabel={mockDetail.workspace.label}
          workbench={{
            brandName: 'ElAgente Workbench',
            threads: mockThreads.map((thread) => ({
              key: thread.id,
              title: thread.title,
              subtitle: thread.provider,
              href: `#${thread.id}`,
              status: thread.status,
              favorite: thread.isPinned,
            })),
            currentKey: mockDetail.thread.id,
            favorite: mockDetail.thread.isPinned,
            workspacePath: mockDetail.workspace.absPath,
            activeView,
            terminalEnabled: true,
            onViewChange: setActiveView,
            onToggleFavorite: () => {},
            onNavigate: () => {},
            onSearch: () => {},
            notifications: [],
            unreadCount: 0,
            onReadNotifications: () => {},
          }}
          activeView={activeView}
          appMenuButton={<AppShellMenuButton />}
          threadActionsButton={threadActionsButton}
          appNavigationMenu={
            <AppShellNavigationMenu
              items={[
                {
                  label: 'Threads',
                  href: '#threads',
                },
                {
                  label: 'Artifacts',
                  href: '#artifacts',
                },
              ]}
            />
          }
          onCloseAppNavigation={() => setMenuOpen(false)}
          timelineProps={{
            scrollRequestKey,
            onTailVisibilityChange: setFollowTail,
          }}
          composerProps={{
            // Hosts hand the composer their capabilities (plan mode enables the slash toolbox).
            capabilities: mockCapabilities,
            disabled: false,
            draftPrompt: '',
            model: mockDetail.thread.model,
            reasoningEffort: mockDetail.thread.reasoningEffort,
            collaborationMode: mockDetail.thread.collaborationMode,
            canInterrupt: true,
            onInterrupt: adapter.interrupt,
            modelPolicy,
            followTail,
            onToggleFollow: () => {
              setFollowTail(true);
              setScrollRequestKey((current) => current + 1);
            },
          }}
          shellComposerProps={{
            disabled: true,
            disabledPlaceholder: 'Shell adapter is not connected in playground',
          }}
          shellEffectiveTheme={playgroundTheme}
          shellThemeMode={playgroundThemeMode}
          onShellStateChange={setShellState}
          metaContent={
            <div className="space-y-2 text-xs text-[var(--theme-fg-muted)]">
              <p>Runtime: {mockStatus.state}</p>
              <p>Shell: {shellState?.status ?? 'mocked'}</p>
              <button
                type="button"
                className="mt-2 h-8 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]"
                onClick={() =>
                  setActiveView((current) =>
                    current === 'chat' ? 'shell' : 'chat',
                  )
                }
              >
                {activeView === 'chat' ? 'Open Shell' : 'Open Chat'}
              </button>
            </div>
          }
        />
        <output
          data-testid="playground-submitted-prompt"
          className="sr-only"
          aria-hidden="true"
        >
          {lastSubmittedPrompt}
        </output>
        <ThreadActionsDialog
          open={threadActionsOpen}
          turnsState={mockExportTurnsState}
          shareAvailable
          shareState={{
            status: 'ready',
            error: null,
            shares: [
              {
                id: 'playground-share-1',
                targetUsername: 'alice',
                label: 'Review',
                threadAccess: 'read',
                workspaceAccess: 'read',
                createdAt: '2026-06-08T14:25:00.000Z',
              },
            ],
          }}
          onCancel={() => setThreadActionsOpen(false)}
          onLoadTurns={() => {}}
          onExport={(_input: ExportThreadTranscriptInput) => {
            setThreadActionsOpen(false);
          }}
          onCreateShare={() => {}}
          onRevokeShare={() => {}}
        />
      </PluginProvider>
    </AppShellNavContext.Provider>
  );
}
