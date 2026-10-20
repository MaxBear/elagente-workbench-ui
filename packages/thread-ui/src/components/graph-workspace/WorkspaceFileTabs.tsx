import { MiddleName } from '../MiddleName';
import { Circle, FileCode2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface WorkspaceFileTab {
  name: string;
  path: string;
  pinned: boolean;
}

export function WorkspaceFileTabs({
  activePath,
  dirtyPaths,
  onClose,
  onSelect,
  tabs,
  trailingAction,
}: {
  activePath: string | null;
  dirtyPaths: ReadonlySet<string>;
  onClose: (path: string) => void;
  onSelect: (path: string) => void;
  tabs: WorkspaceFileTab[];
  trailingAction?: ReactNode;
}) {
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) ?? null;

  if (tabs.length === 0) {
    return null;
  }

  function requestClose(path: string) {
    if (dirtyPaths.has(path)) {
      setPendingClosePath(path);
      return;
    }
    onClose(path);
  }

  return (
    <div className="thread-graph-editor-tabs-shell shrink-0">
      <div className="flex min-w-0 border-b border-[var(--theme-border)]">
        <div
          className="thread-graph-editor-tabs flex min-w-0 flex-1 overflow-x-auto"
          role="tablist"
          aria-label="Open workspace files"
        >
          {tabs.map((tab) => {
            const active = tab.path === activePath;
            const dirty = dirtyPaths.has(tab.path);
            return (
              <div
                key={tab.path}
                className={`thread-graph-editor-tab group/tab flex h-8 min-w-0 max-w-52 shrink-0 items-center border-r ${active ? 'is-active' : ''} ${tab.pinned ? 'is-pinned' : 'is-preview'}`}
                role="presentation"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={tab.path}
                  onClick={() => onSelect(tab.path)}
                  className={`flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left text-xs ${tab.pinned ? '' : 'italic'}`}
                >
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" />
                  <MiddleName name={tab.name} />
                </button>
                <button
                  type="button"
                  onClick={() => requestClose(tab.path)}
                  className="thread-graph-editor-tab-close mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  title={`Close ${tab.name}`}
                  aria-label={`Close ${tab.name}`}
                >
                  {dirty ? (
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {trailingAction ? (
          <div className="thread-graph-editor-tabs-action flex h-8 shrink-0 items-center px-1">
            {trailingAction}
          </div>
        ) : null}
      </div>
      {pendingTab ? (
        <div
          className="thread-graph-editor-close-confirm flex min-h-10 items-center justify-between gap-3 border-b px-3 py-1.5 text-xs"
          role="alert"
        >
          <span className="min-w-0 truncate">
            Discard unsaved changes in {pendingTab.name}?
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPendingClosePath(null)}
              className="h-7 rounded px-2 hover:bg-[var(--theme-hover)]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingClosePath(null);
                onClose(pendingTab.path);
              }}
              className="h-7 rounded bg-rose-500/15 px-2 text-rose-700 hover:bg-rose-500/25 dark:text-rose-200"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
