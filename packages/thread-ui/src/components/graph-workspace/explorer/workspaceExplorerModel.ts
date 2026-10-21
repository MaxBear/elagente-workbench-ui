import { translate, useI18n } from '../../../i18n';
import type { WorkspaceTreeNode } from '../workspaceTree';
import type {
  WorkspaceExplorerChildrenState,
  WorkspaceExplorerModel,
  WorkspaceExplorerNodeRecord,
  WorkspaceExplorerNodeSource,
} from './workspaceExplorerTypes';

function sourceWithoutChildren(
  node: WorkspaceTreeNode,
): WorkspaceExplorerNodeSource {
  const source = { ...node } as WorkspaceExplorerNodeSource & {
    children?: WorkspaceTreeNode[];
  };
  delete source.children;
  return source;
}

function childrenStateForNode(
  node: WorkspaceTreeNode,
): WorkspaceExplorerChildrenState {
  if (node.kind !== 'directory') {
    return 'resolved';
  }
  if (node.childrenLoaded === true || node.children.length > 0) {
    return 'resolved';
  }
  if (node.childrenLoaded === false || node.hasChildren) {
    return 'unresolved';
  }
  return 'resolved';
}

function copyPreviousSubtree(
  previous: WorkspaceExplorerModel,
  nodeId: string,
  parentId: string,
  nodes: Map<string, WorkspaceExplorerNodeRecord>,
  pathToId: Map<string, string>,
) {
  const previousNode = previous.nodes.get(nodeId);
  if (!previousNode) {
    return;
  }
  const copy = {
    ...previousNode,
    parentId,
    childIds: [...previousNode.childIds],
  };
  nodes.set(copy.id, copy);
  pathToId.set(copy.path, copy.id);
  for (const childId of copy.childIds) {
    copyPreviousSubtree(previous, childId, copy.id, nodes, pathToId);
  }
}

export function createWorkspaceExplorerModel(
  root: WorkspaceTreeNode,
  previous: WorkspaceExplorerModel | null = null,
): WorkspaceExplorerModel {
  const nodes = new Map<string, WorkspaceExplorerNodeRecord>();
  const pathToId = new Map<string, string>();

  const visit = (node: WorkspaceTreeNode, parentId: string | null) => {
    const previousId = previous?.pathToId.get(node.path);
    const previousNode = previousId
      ? previous?.nodes.get(previousId)
      : undefined;
    const incomingChildrenState = childrenStateForNode(node);
    const canPreserveResolvedChildren =
      node.kind === 'directory' &&
      incomingChildrenState === 'unresolved' &&
      previousNode?.kind === 'directory' &&
      previousNode.childrenState === 'resolved';
    const childIds = canPreserveResolvedChildren
      ? [...previousNode.childIds]
      : node.children.map((child) => child.id);
    const record: WorkspaceExplorerNodeRecord = {
      id: node.id,
      parentId,
      name: node.name,
      path: node.path,
      kind: node.kind,
      childIds,
      childrenState: canPreserveResolvedChildren
        ? 'resolved'
        : incomingChildrenState,
      hasChildren:
        node.hasChildren ??
        (canPreserveResolvedChildren
          ? previousNode.hasChildren
          : childIds.length > 0),
      truncated: node.truncated ?? previousNode?.truncated ?? false,
      requestGeneration: previousNode?.requestGeneration ?? 0,
      source: sourceWithoutChildren(node),
    };
    nodes.set(record.id, record);
    pathToId.set(record.path, record.id);

    if (canPreserveResolvedChildren && previous) {
      for (const childId of childIds) {
        copyPreviousSubtree(previous, childId, record.id, nodes, pathToId);
      }
      return;
    }
    for (const child of node.children) {
      visit(child, record.id);
    }
  };

  visit(root, null);
  return { rootId: root.id, nodes, pathToId };
}

export function workspaceExplorerModelToTree(
  model: WorkspaceExplorerModel,
): WorkspaceTreeNode {
  const visit = (nodeId: string): WorkspaceTreeNode => {
    const record = model.nodes.get(nodeId);
    if (!record) {
      throw new Error(translate("files.workspaceExplorerNodeIsMissing", { value1: nodeId }));
    }
    const tree: WorkspaceTreeNode = {
      ...record.source,
      children: record.childIds.map(visit),
    };
    if (record.kind === 'directory') {
      tree.childrenLoaded = record.childrenState === 'resolved';
      tree.hasChildren = record.hasChildren;
    } else if (record.source.hasChildren !== undefined) {
      tree.hasChildren = record.hasChildren;
    }
    if (record.truncated || record.source.truncated !== undefined) {
      tree.truncated = record.truncated;
    }
    return tree;
  };
  return visit(model.rootId);
}

export function findWorkspaceExplorerNodeByPath(
  model: WorkspaceExplorerModel | null,
  path: string | null,
) {
  if (!model || path === null) {
    return null;
  }
  const id = model.pathToId.get(path);
  return id ? (model.nodes.get(id) ?? null) : null;
}

export function hasWorkspaceExplorerPath(
  model: WorkspaceExplorerModel | null,
  path: string | null,
) {
  return Boolean(model && path !== null && model.pathToId.has(path));
}

function replaceTreeNodeByPath(
  node: WorkspaceTreeNode,
  path: string,
  replacement: WorkspaceTreeNode,
): WorkspaceTreeNode {
  if (node.path === path) {
    return replacement;
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = replaceTreeNodeByPath(child, path, replacement);
    changed ||= next !== child;
    return next;
  });
  return changed ? { ...node, children } : node;
}

export function mergeWorkspaceExplorerSubtree(
  model: WorkspaceExplorerModel,
  subtree: WorkspaceTreeNode,
) {
  const existing = findWorkspaceExplorerNodeByPath(model, subtree.path);
  if (!existing) {
    return model;
  }
  // Loading children must not rename their parent. Older adapters returned the
  // workspace label for every subtree root, despite retaining the correct path.
  subtree = { ...subtree, id: existing.id, name: existing.name, path: existing.path };
  const root = workspaceExplorerModelToTree(model);
  return createWorkspaceExplorerModel(
    replaceTreeNodeByPath(root, subtree.path, subtree),
    model,
  );
}

export function replaceWorkspaceExplorerNodeChildren(
  model: WorkspaceExplorerModel,
  path: string,
  children: WorkspaceTreeNode[],
  options: { truncated?: boolean } = {},
) {
  const node = findWorkspaceExplorerNodeByPath(model, path);
  if (!node || node.kind !== 'directory') {
    return model;
  }
  return mergeWorkspaceExplorerSubtree(model, {
    ...node.source,
    children,
    childrenLoaded: true,
    hasChildren: children.length > 0,
    truncated: options.truncated ?? node.truncated,
  });
}

export function beginWorkspaceExplorerDirectoryRequest(
  model: WorkspaceExplorerModel,
  path: string,
) {
  const id = model.pathToId.get(path);
  const node = id ? model.nodes.get(id) : undefined;
  if (!node || node.kind !== 'directory') {
    return { model, generation: null };
  }
  const generation = node.requestGeneration + 1;
  const nodes = new Map(model.nodes);
  nodes.set(node.id, {
    ...node,
    childrenState: 'loading',
    requestGeneration: generation,
    error: undefined,
  });
  return { model: { ...model, nodes }, generation };
}

export function completeWorkspaceExplorerDirectoryRequest(
  model: WorkspaceExplorerModel,
  input: {
    path: string;
    generation: number;
    children: WorkspaceTreeNode[];
    truncated?: boolean;
  },
) {
  const node = findWorkspaceExplorerNodeByPath(model, input.path);
  if (!node || node.requestGeneration !== input.generation) {
    return model;
  }
  return replaceWorkspaceExplorerNodeChildren(
    model,
    input.path,
    input.children,
    input.truncated === undefined ? {} : { truncated: input.truncated },
  );
}

export function failWorkspaceExplorerDirectoryRequest(
  model: WorkspaceExplorerModel,
  input: { path: string; generation: number; error: string },
) {
  const node = findWorkspaceExplorerNodeByPath(model, input.path);
  if (!node || node.requestGeneration !== input.generation) {
    return model;
  }
  const nodes = new Map(model.nodes);
  nodes.set(node.id, {
    ...node,
    childrenState: 'error',
    error: input.error,
  });
  return { ...model, nodes };
}
