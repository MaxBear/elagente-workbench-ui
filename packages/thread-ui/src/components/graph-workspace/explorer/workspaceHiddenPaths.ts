import type { ThreadWorkspaceAdapter } from '../../../adapters';
import {
  ancestorDirectoryPaths,
  compareWorkspaceNodes,
  workspaceTreeNodeToGraphNode,
  type WorkspaceTreeNode,
} from '../workspaceTree';

/**
 * ELA-260: `.workbenchignore` hides paths from `file/list` only. A link into a
 * hidden folder reveals just the chain down to its target, marked hidden by
 * default, without turning on Show hidden files.
 */
export interface RevealedHiddenPath {
  /** The linked target, workspace-relative. */
  targetPath: string;
  /** The first hidden ancestor (or the target), holding only the chain below it. */
  node: WorkspaceTreeNode;
}

/** Internal state the server never lists or serves; a link to it is missing. */
export function isInternalWorkspacePath(path: string) {
  return path.split('/').some((segment) => segment.startsWith('.elagente'));
}

export function parentWorkspacePath(path: string) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function markHidden(node: WorkspaceTreeNode): WorkspaceTreeNode {
  return { ...node, hiddenByDefault: true, children: node.children.map(markHidden) };
}

type ListHidden = (path: string) => Promise<Awaited<ReturnType<ThreadWorkspaceAdapter['listTree']>>>;

/**
 * Lists `chain` from `parentPath` with hidden entries, keeping only the chain.
 * Null when an entry is absent or the server refuses: the link is missing.
 */
export async function resolveHiddenChain(
  listHidden: ListHidden,
  targetPath: string,
  firstHiddenPath: string,
  isCurrent: () => boolean,
): Promise<RevealedHiddenPath | null> {
  const chain = [...ancestorDirectoryPaths(targetPath), targetPath];
  const start = chain.indexOf(firstHiddenPath);
  if (start < 0 || isInternalWorkspacePath(targetPath)) return null;
  const nodes: WorkspaceTreeNode[] = [];
  try {
    for (const path of chain.slice(start)) {
      const listing = await listHidden(parentWorkspacePath(path));
      if (!isCurrent()) return null;
      const entry = (listing.children ?? [])
        .map(workspaceTreeNodeToGraphNode)
        .find((child) => child.path === path);
      if (!entry || (path !== targetPath && entry.kind !== 'directory')) return null;
      nodes.push({ ...entry, children: [] });
    }
    const leaf = nodes.at(-1)!;
    if (leaf.kind === 'directory') {
      // A linked folder opens with its contents.
      const listing = workspaceTreeNodeToGraphNode(await listHidden(targetPath));
      if (!isCurrent()) return null;
      nodes[nodes.length - 1] = {
        ...leaf,
        children: listing.children,
        childrenLoaded: true,
        hasChildren: listing.children.length > 0,
      };
    }
  } catch {
    return null;
  }
  let node = nodes.at(-1)!;
  for (let index = nodes.length - 2; index >= 0; index -= 1) {
    node = { ...nodes[index]!, children: [node], childrenLoaded: true, hasChildren: true };
  }
  return { targetPath, node: markHidden(node) };
}

function insertNode(
  tree: WorkspaceTreeNode,
  parentPath: string,
  node: WorkspaceTreeNode,
): WorkspaceTreeNode {
  if (tree.path === parentPath) {
    const existing = tree.children.find((child) => child.path === node.path);
    if (!existing) {
      return { ...tree, children: [...tree.children, node].sort(compareWorkspaceNodes) };
    }
    // Already listed (Show hidden files, or another revealed link): merge below it.
    if (existing.kind !== 'directory' || node.kind !== 'directory') return tree;
    let merged = existing;
    for (const child of node.children) merged = insertNode(merged, node.path, child);
    return merged === existing
      ? tree
      : { ...tree, children: tree.children.map((child) => (child === existing ? merged : child)) };
  }
  const next = tree.children.find(
    (child) =>
      child.kind === 'directory' &&
      (parentPath === child.path || parentPath.startsWith(`${child.path}/`)),
  );
  if (!next) return tree;
  const updated = insertNode(next, parentPath, node);
  return updated === next
    ? tree
    : { ...tree, children: tree.children.map((child) => (child === next ? updated : child)) };
}

/** The listed workspace tree with each revealed chain inserted under its listed parent. */
export function withRevealedHiddenPaths(
  tree: WorkspaceTreeNode,
  revealed: readonly RevealedHiddenPath[],
) {
  let next = tree;
  for (const entry of revealed) {
    next = insertNode(next, parentWorkspacePath(entry.node.path), entry.node);
  }
  return next;
}

export function hasRevealedHiddenPath(
  revealed: readonly RevealedHiddenPath[],
  path: string | null,
) {
  if (path === null) return false;
  const visit = (node: WorkspaceTreeNode): boolean =>
    node.path === path || node.children.some(visit);
  return revealed.some((entry) => visit(entry.node));
}
