import { translate, useI18n } from '../../../i18n';
import { useMemo } from 'react';

const STORAGE_PREFIX = 'remote-codex:graphchat:workspace:expanded:';
const MAX_PERSISTED_EXPANDED_PATHS = 500;

export interface WorkspaceExplorerIdentity {
  threadId: string;
  workspaceId?: string | null;
}

export interface PersistedWorkspaceExplorerState {
  version: 2;
  expandedPaths: string[];
  selectedPath?: string;
  filterMode?: 'highlight' | 'filter';
}

function storageKey(identity: WorkspaceExplorerIdentity) {
  return `${STORAGE_PREFIX}${identity.workspaceId ?? 'workspace'}:${identity.threadId}`;
}

export function readWorkspaceExplorerState(
  identity: WorkspaceExplorerIdentity,
): PersistedWorkspaceExplorerState {
  const fallback: PersistedWorkspaceExplorerState = {
    version: 2,
    expandedPaths: [],
  };
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(identity));
    if (!raw) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        version: 2,
        expandedPaths: parsed
          .filter((value): value is string => typeof value === 'string')
          .slice(0, MAX_PERSISTED_EXPANDED_PATHS),
      };
    }
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== 2 || !Array.isArray(candidate.expandedPaths)) {
      return fallback;
    }
    const selectedPath =
      typeof candidate.selectedPath === 'string'
        ? candidate.selectedPath
        : undefined;
    const filterMode =
      candidate.filterMode === 'filter' || candidate.filterMode === 'highlight'
        ? candidate.filterMode
        : undefined;
    return {
      version: 2,
      expandedPaths: candidate.expandedPaths
        .filter((value): value is string => typeof value === 'string')
        .slice(0, MAX_PERSISTED_EXPANDED_PATHS),
      ...(selectedPath ? { selectedPath } : {}),
      ...(filterMode ? { filterMode } : {}),
    };
  } catch {
    return fallback;
  }
}

export function writeWorkspaceExplorerState(
  identity: WorkspaceExplorerIdentity,
  state: Omit<PersistedWorkspaceExplorerState, 'version'>,
) {
  if (typeof window === 'undefined') {
    return;
  }
  const expandedPaths = [...new Set(state.expandedPaths)]
    .filter((path) => path.length > 0)
    .slice(0, MAX_PERSISTED_EXPANDED_PATHS);
  const value: PersistedWorkspaceExplorerState = {
    version: 2,
    expandedPaths,
    ...(state.selectedPath ? { selectedPath: state.selectedPath } : {}),
    ...(state.filterMode ? { filterMode: state.filterMode } : {}),
  };
  try {
    window.localStorage.setItem(storageKey(identity), JSON.stringify(value));
  } catch {
    // Explorer persistence is an enhancement; storage can be unavailable.
  }
}

export function useWorkspaceExplorerPersistence(
  identity: WorkspaceExplorerIdentity,
) {
  useI18n();
  return useMemo(
    () => ({
      key: storageKey(identity),
      read: () => readWorkspaceExplorerState(identity),
      write: (state: Omit<PersistedWorkspaceExplorerState, 'version'>) =>
        writeWorkspaceExplorerState(identity, state),
    }),
    [identity],
  );
}
