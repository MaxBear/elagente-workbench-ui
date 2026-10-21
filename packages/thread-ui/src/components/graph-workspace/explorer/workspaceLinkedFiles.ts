import type { WorkspaceTreeNode } from '../workspaceTree';

export const LINKED_DIRECTORY_ID_PREFIX = 'linked-dir:';

/** Real parent of an absolute linked file: POSIX, Windows drive or UNC share. */
export function linkedParentDirectory(path: string) {
  const index = path.lastIndexOf('/');
  const parent = index >= 0 ? path.slice(0, index) : '';
  if (/^[a-z]:$/i.test(parent)) return `${parent}/`;
  return parent || '/';
}

/**
 * Files opened from links outside the workspace are grouped under their real
 * parent directory. Only the permitted files are listed; the device API does not
 * list host directories, so the group never pretends to show siblings.
 */
export function linkedDirectoryNodes(files: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
  const groups = new Map<string, WorkspaceTreeNode[]>();
  for (const file of files) {
    const parent = linkedParentDirectory(file.path);
    groups.set(parent, [...(groups.get(parent) ?? []), file]);
  }
  return [...groups].map(([parent, children]) => ({
    id: `${LINKED_DIRECTORY_ID_PREFIX}${parent}`,
    name: parent,
    path: parent,
    kind: 'directory' as const,
    children: [...children].sort((left, right) => left.name.localeCompare(right.name)),
    childrenLoaded: true,
    hasChildren: true,
  }));
}
