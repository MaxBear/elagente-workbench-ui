# VS Code-Inspired Workspace Explorer Refactor Plan

Date: 2026-09-02

Status: implementation complete, including the visible editor layer

Base branch: `rust/acp-rewrite-composer-stop`

Research branch: `codex/vscode-explorer-feasibility`

Base commit: `cc44f0eeadaf9c37bb051bdb236997a976696d9a`

VS Code reference commit: `45f3f80c81c77d878ff93b9222acb7e8514ae996`

Primary package: `packages/thread-ui`

## Implementation Progress

Checkpoint: 2026-09-02

- Phase 0 complete.
  - Added `GraphWorkspaceExplorer.test.tsx` with fake-adapter coverage for root
    loading, first-file preview, lazy directory expansion, refresh preservation,
    stale root response rejection, deep path focus, upload, download, and the
    current mobile preview transition.
  - No verbatim Code - OSS source was copied, so a third-party notice was not
    added in this checkpoint.
- Phase 1 complete.
  - Added normalized Explorer node records with stable ID and path indexes.
  - Added resolved, unresolved, loading, and error directory states.
  - Added subtree merging that preserves previously resolved children when a
    parent refresh returns them unresolved and removes stale children when a
    directory is authoritatively resolved.
  - Added request generations for stale completion rejection.
  - Added deterministic visible-row projection with directory-first ordering
    and ARIA position metadata.
  - Routed the adapter-backed tree in `GraphWorkspaceExplorer.tsx` through the
    normalized model while retaining the existing rendered UI.
- Phase 2 complete.
  - Extracted root and directory loading, refresh, focus reveal, selection,
    expansion, request generations, live change subscription, and persistence
    into dedicated hooks.
  - Extracted file preview and workspace action orchestration; reduced
    `GraphWorkspaceExplorer.tsx` from 1,398 lines to approximately 400 lines.
  - Added V2 persistence with migration from the existing expanded-path array.
- Phase 3 complete.
  - Replaced the recursive tree with an ARIA tree using roving focus and a pure
    VS Code-style keyboard command reducer.
  - Added headless `@tanstack/react-virtual` windowing with a non-virtualized
    jsdom test mode.
- Phase 4 complete.
  - Added Collapse All, inline Filter and Highlight modes, match counts,
    loaded-folder scope messaging, compact folders, loading skeletons, root
    Retry, directory-scoped Retry, and a capability-driven More menu.
  - Replaced the selected-row side stripe with full-row selection and a
    separate keyboard focus outline.
- Phase 5 complete.
  - Mobile file selection now opens the Viewer in one action.
  - Chat focus requests carry their optional line into source preview, highlight
    it, and scroll it into view.
- Phase 6 partially complete by design.
  - Generic workspace change subscriptions are debounced into state-preserving
    refreshes.
  - Optional create, rename, delete, and structured event adapter extensions are
    deferred until consuming hosts expose those capabilities.
- Phase 7 complete.
  - Added a visibly VS Code-inspired editor surface with Monaco on desktop,
    source breadcrumbs, preview tabs, double-click pinning, multi-file pinned
    tabs, dirty indicators, keyboard save, and inline dirty-close confirmation.
  - Monaco and its editor worker are emitted as lazy package chunks. The
    workspace panel and mobile layout do not pay the Monaco startup cost until
    a desktop text file is opened.
  - Mobile retains the lightweight highlighted source and textarea editor to
    avoid loading the desktop editor runtime and to preserve touch behavior.
  - Added indentation guides to the Explorer while retaining the product's own
    colors, spacing, icons, adapter contract, and non-file preview renderers.

Checkpoint validation:

- `pnpm --filter @remote-codex/thread-ui typecheck`: pass.
- `pnpm --filter @remote-codex/thread-ui lint`: pass with three pre-existing
  Hook dependency warnings outside the Explorer change.
- `pnpm --filter @remote-codex/thread-ui test`: pass, 64 files and 341 tests.
- `pnpm --filter @remote-codex/thread-ui build`: pass; built `dist` refreshed.
- `pnpm --filter @remote-codex/thread-ui-playground test`: pass, 3 tests.
- `pnpm --filter @remote-codex/thread-ui-playground build`: pass with the
  existing large-chunk warning for the playground entry and C++ grammar chunk.
- Browser, 1,280px dark: 10,001 projected nodes produced 23 DOM treeitems and a
  280,044px virtual scroll range.
- Browser, 1,280px narrow Explorer: the 164px panel switched to a 77px two-row
  header; the toolbar remained inside the panel and did not overlap the title.
- Browser filter: query `09999` reduced the tree to root plus one matching file
  and announced `1 match`.
- Browser, 900px light: Explorer and Viewer switched to a 296px-wide vertical
  stack with no document overflow.
- Browser, 390x844 dark: tree rows measured 44px, no document overflow was
  observed, and selecting a file replaced the tree with the correct Viewer.
- Browser, 1,280px dark: Monaco rendered real editor lines, a double-clicked
  file remained as a pinned tab while the next selected file replaced the
  preview tab, and editing produced a dirty indicator plus inline close
  confirmation.
- Browser, 390x844 dark: text files used the lightweight source viewer, Monaco
  was absent, one active file tab was visible, and no document overflow was
  observed.
- Browser, 945x1433 dark: the shell switched to a workspace focus view, giving
  the workspace 637px instead of sharing a 336px column with chat. Explorer
  remained left of the 452px Editor, with no horizontal overflow.
- The visible workspace chrome now uses a 36px mode bar, 36px Explorer header,
  and 32px file tab bar. The redundant Editor heading and file language/byte
  metadata row were removed; root files open directly below their tab, while
  breadcrumbs appear only for nested paths.
- Tool Usage and Guide were removed from the workspace mode bar. Their legacy
  feature keys remain accepted for host compatibility but cannot activate a
  removed view.
- Browser pane recovery: hiding Explorer exposes a Show Explorer action in the
  Editor tab bar; hiding Editor exposes a Show Editor action in Explorer. Both
  actions restore the resizable split without closing the whole workspace.

## 1. Executive Decision

The workspace explorer should be improved by adopting the interaction model and
internal separation used by the open-source VS Code web workbench, while keeping
the current Pockymoe React surface, adapter contract, plugin previews, and
mobile behavior.

The implementation should not import the VS Code workbench or its Explorer view
directly. Those modules depend on VS Code's internal service container, file
service, configuration service, command registry, editor service, context keys,
storage service, theme service, and virtualized tree implementation. Importing
them would effectively embed or fork the complete workbench.

The plan therefore uses three levels of reuse:

1. Direct source reuse is allowed only for small, pure, independently testable
   Code - OSS algorithms when the dependency graph remains local.
2. Structural reuse applies to the Explorer model, async data source, renderer,
   filter, sorter, identity, view state, and command separation.
3. Behavioral reuse applies to keyboard navigation, selection, preview,
   auto-reveal, compact folders, filtering, and targeted refresh.

The first implementation milestone must improve the existing tree without
changing the public `ThreadWorkspaceAdapter` contract. Later milestones can add
optional adapter capabilities without breaking web, Android WebView, iOS
WebView, playground, or other package consumers.

## 2. Product Context

The Explorer is part of a private operator console used from a desktop, phone,
or secondary browser. It is not a general-purpose IDE sidebar.

The physical usage scene is a developer checking or editing files on their own
machine from a dim room, a phone, or a secondary screen while an agent is
running. This favors the existing restrained dark and light themes, compact
desktop density, clear selection state, and larger mobile touch targets.

The improved Explorer must continue to support:

- Workspace files supplied through a host adapter.
- Synthetic live items, thread events, artifacts, and plugin renderers.
- Read-only and writable workspace modes.
- Markdown, highlighted source, image, PDF, and molecule previews.
- Desktop split panes and mobile Explorer-to-Viewer navigation.
- File focus requests originating from chat content.
- Lazy package loading through the `workspace-panel` entrypoint.

## 3. Goals

### 3.1 Usability goals

- Make keyboard and pointer behavior predictable for users familiar with VS
  Code, Finder, and other file explorers.
- Make selection, keyboard focus, opened preview, and expanded state distinct.
- Add fast collapse and filtering workflows without adding persistent visual
  noise.
- Keep the active file revealable without unexpectedly moving the tree during
  normal browsing.
- Preserve the tree viewport through refresh, panel collapse, and workspace
  updates.
- Make loading and failure states local to the affected directory when
  possible.

### 3.2 Architecture goals

- Reduce `GraphWorkspaceExplorer.tsx` from a 1,398-line stateful component to a
  composition root of approximately 300 to 450 lines.
- Separate pure tree state and projection logic from React rendering and async
  adapter calls.
- Give every visible row a stable identity independent of its array index.
- Make expansion, filtering, keyboard navigation, and refresh logic testable
  without mounting the entire workspace panel.
- Preserve the existing public package entrypoints and lazy workspace bundle.

### 3.3 Quality goals

- Full keyboard navigation and screen-reader tree semantics.
- At least 44px row and action targets on touch layouts.
- No selected-row side stripe. Selection uses a full-row surface; keyboard
  focus uses a separate visible focus treatment.
- No new hard-coded theme colors when existing theme variables are sufficient.
- No unbounded full-tree refetch for ordinary directory expansion or file
  change events.
- No regression in workspace-panel lazy loading or plugin preview behavior.

## 4. Non-Goals

The following are explicitly outside the first milestone:

- Embedding the full Code - OSS workbench.
- Replacing non-text artifact, image, PDF, Markdown preview, or molecule
  renderers with Monaco Editor.
- Running VS Code extensions in Pockymoe.
- Recreating the VS Code command palette or activity bar.
- Git status decorations, source-control commands, or diagnostics badges.
- Multi-root workspaces.
- Drag and drop, multi-selection, clipboard file operations, or compare editors.
- Removing the current artifact and plugin projection from the workspace tree.
- Expanding host filesystem permissions beyond the selected workspace.

## 5. Upstream Reference And Reuse Policy

### 5.1 Primary Code - OSS references

The source review for this plan is pinned to Code - OSS commit
`45f3f80c81c77d878ff93b9222acb7e8514ae996`. Each later port or adaptation must
record a different upstream commit if the implementation deliberately moves to
a newer snapshot.

- `src/vs/workbench/contrib/files/browser/views/explorerView.ts`
  - View state persistence.
  - Auto-reveal and active resource selection.
  - Targeted refresh and refresh serialization.
  - Focus, selection, and context state.
- `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`
  - `ExplorerDataSource` async child resolution.
  - `FilesRenderer` presentation boundary.
  - `FilesFilter` and `FileSorter` separation.
  - `ExplorerFindProvider` filtering behavior.
  - `ExplorerCompressionDelegate` compact-folder behavior.
- `src/vs/workbench/contrib/files/common/explorerModel.ts`
  - Stable resource identity.
  - Resolved versus unresolved directory state.
  - Merging refreshed filesystem state without discarding unaffected children.
  - Rename and move path propagation.
- `src/vs/base/browser/ui/tree/*`
  - Behavioral reference for focus, selection, keyboard navigation, ARIA, and
    virtualized rows.
- `src/vs/base/common/filters.ts`
  - Candidate source for a small fuzzy-match implementation if direct reuse is
    demonstrably smaller and clearer than a local implementation.

Official repository:
https://github.com/microsoft/vscode

### 5.2 What may be copied directly

Direct copying is limited to pure functions or small algorithms that meet every
condition below:

- The code does not import `vs/workbench`, service decorators, context keys,
  editor services, or VS Code DOM abstractions.
- Its transitive dependency set is smaller than implementing the behavior
  locally.
- A focused unit test can describe the complete local contract.
- The source file records the upstream repository path and pinned commit.
- The Microsoft MIT copyright header is retained where required.
- A project-level third-party notice entry is added before copied code ships.

The repository currently has no top-level `LICENSE` or third-party notice file.
Before any verbatim Code - OSS source is committed, add and review an explicit
attribution mechanism such as `THIRD_PARTY_NOTICES.md`. This is an engineering
and distribution gate, not a reason to avoid learning from the source.

### 5.3 What must not be copied directly

- `ExplorerView` and `FilesRenderer` classes as complete units.
- `WorkbenchCompressibleAsyncDataTree` and its internal service dependencies.
- VS Code CSS selectors, global workbench styles, or product branding.
- Internal command IDs or context-key infrastructure that has no host-facing
  equivalent.
- Workbench storage, editor, file-service, extension-host, or menu services.

These should be represented by small local interfaces and React components.

### 5.4 External virtualization dependency

VS Code's tree virtualization cannot be reused without its internal list stack.
Use `@tanstack/react-virtual` for the flattened visible row list once the model
split is complete. It is headless, MIT licensed, and allows the existing markup
and styling to remain under Pockymoe control.

Implementation constraints:

- Use stable node IDs through `getItemKey`.
- Use fixed desktop and mobile row estimates.
- Set `useFlushSync: false` for React 19 compatibility.
- Use a modest overscan, initially 6 rows.
- Do not enable smooth programmatic scrolling for reveal operations; deterministic
  `auto` scrolling avoids conflicts with dynamic tree expansion.
- Keep a non-virtualized mode in jsdom tests so keyboard and ARIA assertions do
  not depend on layout measurement.

Reference:
https://tanstack.com/virtual/latest/docs/framework/react/react-virtual

## 6. Current Architecture Assessment

### 6.1 Current ownership

| File | Current responsibility | Main issue |
| --- | --- | --- |
| `GraphWorkspaceExplorer.tsx` | Tree rendering, expansion, persistence, async loading, refresh, selection, file reads, upload, download, garbage actions, panel collapse, and responsive layout | Too many state machines and effects in one component |
| `workspaceTree.ts` | Synthetic tree construction, path helpers, tree lookup and replacement | Mixes domain projection with generic tree operations |
| `GraphWorkspacePreviewPane.tsx` | Code, Markdown, image, PDF, molecule, artifact, metadata, event, and editing views | Large but already separable from tree work |
| `adapters.ts` | Public host boundary for workspace I/O | Good boundary; optional capability vocabulary is incomplete |
| `ThreadGraphWorkspacePanel.tsx` | Workspace/tool/guide/graph/extensions tab composition | Correct owner; should remain unchanged except prop plumbing |
| `layout-workspace.css` and `history-markdown.css` | Explorer, Viewer, graph, and Markdown styling | Explorer styles are spread across domain files |

### 6.2 Current strengths to preserve

- `ThreadWorkspaceAdapter` keeps host-specific transport outside thread-ui.
- Directory children are loaded lazily.
- Expanded paths are persisted per thread and workspace.
- Refresh merges previously loaded directory children.
- File focus requests expand ancestor directories.
- Preview content is loaded only for the selected workspace file.
- Large text files support chunked loading.
- Image and PDF files use raw URLs rather than UTF-8 preview conversion.
- Write, upload, download, and garbage actions are capability-gated.
- Desktop and mobile layouts use different structural arrangements.
- Workspace implementation remains in the lazy `workspace-panel` entrypoint.

### 6.3 Current problems

#### Tree semantics and navigation

- Rows are recursive buttons rather than one composite ARIA tree.
- There is no roving tab index, Arrow key navigation, Home/End behavior, or
  type-to-find.
- Directory expansion and row selection are different code paths but are not
  expressed as a unified command model.
- Every file row can expose several tab stops through hover actions.

#### State ownership

- Selection, expansion, loading, errors, preview state, responsive mode, panel
  collapse, and scroll restoration all live in one component.
- The tree is nested data, so a child refresh repeatedly traverses and copies
  ancestors.
- Async requests use component-local cancellation only for preview loading;
  directory requests and refreshes have no shared generation policy.
- Persisted state stores only expanded paths. Selection, filter state, and a
  stable reveal policy are implicit.

#### Refresh behavior

- `subscribeWorkspaceChanged` is currently not used; the effect intentionally
  leaves refresh under manual control.
- A full refresh reloads the root and each previously loaded expanded directory
  sequentially.
- An error is global to the whole workspace panel rather than attached to the
  directory or file request that failed.

#### Interaction gaps

- There is no Collapse All action.
- There is no file-name filter or find mode.
- There is no compact-folder projection.
- The `focusPathRequest.line` value is not carried into the Viewer.
- Single selection, file preview, and mobile transition require separate
  gestures.
- The selected row uses a 3px inset side marker.
- Mobile row targets use `min-h-9`, below the product's 44px target.

#### Test gaps

- There is no dedicated `GraphWorkspaceExplorer` component test.
- `workspaceTree.test.ts` currently covers only path normalization.
- There are no tests for lazy expansion races, refresh preservation, keyboard
  navigation, filtering, compact folders, selection/focus distinction, or
  responsive file activation.

## 7. Target Architecture

### 7.1 Target module layout

Create the following private modules under
`packages/thread-ui/src/components/graph-workspace/explorer/`:

```text
explorer/
  WorkspaceExplorerPanel.tsx
  WorkspaceExplorerToolbar.tsx
  WorkspaceExplorerTree.tsx
  WorkspaceExplorerRow.tsx
  WorkspaceExplorerStatus.tsx
  useWorkspaceExplorerController.ts
  useWorkspaceExplorerPersistence.ts
  workspaceExplorerCommands.ts
  workspaceExplorerCommands.test.ts
  workspaceExplorerFilter.ts
  workspaceExplorerFilter.test.ts
  workspaceExplorerModel.ts
  workspaceExplorerModel.test.ts
  workspaceExplorerProjection.ts
  workspaceExplorerProjection.test.ts
  workspaceExplorerTypes.ts
```

Keep these existing files:

- `GraphWorkspaceExplorer.tsx`: composition root for Explorer, Viewer, upload,
  preview loading, panel layout, and adapter integration.
- `GraphWorkspacePreviewPane.tsx`: Viewer implementation.
- `workspaceTree.ts`: Pockymoe domain projection for live nodes, artifacts,
  thread events, and fallback trees. Generic workspace tree mutation helpers
  should move to the Explorer model modules.

### 7.2 Responsibility boundaries

#### `workspaceExplorerTypes.ts`

Own internal types only. Do not export these from the package root in the first
milestone.

```ts
type ExplorerNodeId = string;

interface ExplorerNodeRecord {
  id: ExplorerNodeId;
  parentId: ExplorerNodeId | null;
  name: string;
  path: string;
  kind: WorkspaceTreeNode['kind'];
  childIds: ExplorerNodeId[];
  childrenState: 'unresolved' | 'loading' | 'resolved' | 'error';
  hasChildren: boolean;
  truncated: boolean;
  source: WorkspaceTreeNode;
}

interface ExplorerViewState {
  expandedIds: Set<ExplorerNodeId>;
  selectedId: ExplorerNodeId | null;
  focusedId: ExplorerNodeId | null;
  filterQuery: string;
  filterMode: 'highlight' | 'filter';
}

interface ExplorerRowProjection {
  id: ExplorerNodeId;
  depth: number;
  posInSet: number;
  setSize: number;
  expanded: boolean | undefined;
  compactPathSegments?: string[];
  matchRanges?: Array<{ start: number; end: number }>;
}
```

#### `workspaceExplorerModel.ts`

Pure normalized tree operations:

- Convert `WorkspaceTreeNode` into node records.
- Upsert a loaded subtree.
- Replace a directory's children while preserving unaffected descendants.
- Mark a directory loading or failed.
- Remove stale descendants after a successful refresh.
- Find ancestors and descendants using IDs without scanning the full tree.
- Resolve a path to an existing node.
- Preserve selection and focus by path across root refreshes.
- Track a monotonically increasing request generation per directory.

The model must distinguish unresolved, resolved-empty, loading, and error.
`hasChildren: true` is not sufficient to infer that children are already loaded.

#### `workspaceExplorerProjection.ts`

Pure view projection:

- Flatten only visible expanded nodes.
- Produce ARIA `level`, `posinset`, and `setsize` data.
- Apply directory-first sorting without mutating model storage.
- Produce compact-folder rows for resolved single-directory chains.
- Apply filter or highlight results.
- Return a node-id-to-visible-index map for keyboard navigation and reveal.

Compact folders must not combine across:

- An unresolved or loading directory.
- A truncated directory.
- A directory containing a file or more than one visible child.
- A filter boundary that would hide part of the path.
- Synthetic `live`, artifact, event, or metadata nodes.

#### `workspaceExplorerCommands.ts`

Convert user intent into pure commands. Inputs include the pressed key, visible
rows, current focus, expansion state, and platform modifier state.

Supported commands in milestone one:

- Move focus: ArrowUp, ArrowDown, Home, End.
- Expand or enter: ArrowRight.
- Collapse or focus parent: ArrowLeft.
- Select and preview: Enter or Space.
- Collapse all.
- Reveal selected.
- Open and close filter.
- Clear filter with Escape.

The command module returns intent. It must not touch DOM, React state, or the
adapter.

#### `workspaceExplorerFilter.ts`

Own normalized file-name matching and match ranges.

Milestone-one behavior:

- Case-insensitive matching.
- Prefer consecutive matches and path-segment starts.
- Match against the node name by default.
- Match the relative path when the query contains `/`.
- Keep matching ancestors visible in filter mode.
- Do not fetch unopened directories just to satisfy a client-side query.
- Show a clear message that results cover loaded folders when unresolved
  directories remain.

A small Code - OSS fuzzy matching function may be ported here if it passes the
reuse policy in section 5.2. Otherwise implement the same local contract without
copying workbench dependencies.

#### `useWorkspaceExplorerPersistence.ts`

Own versioned local storage:

```ts
interface PersistedExplorerStateV2 {
  version: 2;
  expandedPaths: string[];
  selectedPath?: string;
  filterMode?: 'highlight' | 'filter';
}
```

Rules:

- Continue reading the existing expanded-path key as a version-one fallback.
- Never persist loading, error, filter text, or object references.
- Cap persisted expanded paths to a documented safe maximum.
- Ignore malformed or unavailable storage without surfacing a user error.
- Namespace state by workspace and thread, preserving current behavior.

#### `useWorkspaceExplorerController.ts`

Own React state and adapter effects:

- Initialize and reset the model when workspace identity changes.
- Load root and directory children.
- Deduplicate concurrent loads by path.
- Ignore stale completions using per-path request generations.
- Expand ancestors for focus requests.
- Apply selection, focus, expansion, and filter commands.
- Persist view state.
- Restore focus after refresh without stealing browser focus.
- Expose a narrow render contract to the tree and toolbar.

The controller must not own file preview content, image/PDF URLs, upload,
download, garbage dialogs, or pane-resize state. Those remain in the
`GraphWorkspaceExplorer` composition root.

#### Presentation components

- `WorkspaceExplorerPanel.tsx`: header, toolbar, filter field, status, and tree
  composition.
- `WorkspaceExplorerToolbar.tsx`: capability-driven icon actions with tooltips.
- `WorkspaceExplorerTree.tsx`: ARIA tree, virtualizer, active descendant or
  roving focus, and scroll-to-row behavior.
- `WorkspaceExplorerRow.tsx`: one row, disclosure control, icon, highlighted
  label, secondary actions, and directory loading affordance.
- `WorkspaceExplorerStatus.tsx`: empty, filtered-empty, partial-results,
  directory error, and root error messages.

## 8. Interaction Specification

### 8.1 Selection, focus, and preview

- Selection is the file or synthetic item shown in the Viewer.
- Focus is the tree row receiving keyboard commands.
- Expansion belongs only to directory rows.
- Pointer click on a file selects and previews it.
- Pointer click on a directory label selects it; clicking its disclosure icon
  toggles it.
- Double click on a directory label toggles it on desktop.
- On mobile, tapping a file selects it and transitions to the Viewer in the same
  action.
- A chat focus request expands ancestors, selects the file, loads the preview,
  and passes the optional line to the source viewer.
- Refresh preserves the selected path when it still exists. If it disappears,
  select the nearest existing ancestor, then the first previewable item.

Pinned editor tabs are deferred. The first milestone retains one Viewer.

### 8.2 Keyboard behavior

The tree is one Tab stop.

| Key | Behavior |
| --- | --- |
| ArrowDown | Focus next visible row |
| ArrowUp | Focus previous visible row |
| ArrowRight | Expand a collapsed directory; otherwise focus first child |
| ArrowLeft | Collapse an expanded directory; otherwise focus its parent |
| Home | Focus first visible row |
| End | Focus last visible row |
| Enter | Select and preview file; toggle directory |
| Space | Select and preview without toggling a directory |
| Escape | Clear filter, then close filter, then leave state unchanged |
| Cmd/Ctrl+F | Open Explorer filter when tree focus is inside the Explorer |

Do not intercept browser or page shortcuts when focus is in an input, textarea,
contenteditable element, or the Viewer.

### 8.3 Toolbar

Desktop order:

1. Filter.
2. Collapse all.
3. Upload, when available.
4. Refresh.
5. More actions, only when garbage or future file commands exist.
6. Collapse Explorer pane.

Mobile order:

1. Filter.
2. Collapse all.
3. Refresh.
4. More actions containing upload and destructive operations.
5. Show Viewer.

The destructive garbage action must not remain visually adjacent to routine
refresh without a menu boundary.

### 8.4 Filter behavior

- Filter opens inline below the Explorer header, not in a modal.
- Input receives focus immediately when opened from the toolbar or shortcut.
- Results update while typing.
- `Highlight` mode keeps the current visible tree and emphasizes matches.
- `Filter` mode shows matches and their ancestors.
- The mode is a two-option segmented control and persists per workspace.
- A result count is announced through an ARIA live region.
- Clearing the query restores the exact pre-filter expansion state.
- Filtered results never mutate persisted expansion state.

### 8.5 Loading and error behavior

- Initial root loading uses stable skeleton rows, not centered text.
- Expanding an unresolved directory immediately shows it expanded with one
  non-interactive loading child.
- A directory failure leaves the directory expanded and shows a retry child.
- Root failure replaces the tree with a concise error and Retry action.
- Preview read errors remain in the Viewer and do not erase the tree.
- Refresh icon motion respects `prefers-reduced-motion`.

### 8.6 Visual treatment

- Use the existing theme variables and restrained palette.
- Selected row: full-row subtle accent mix.
- Focused row: one-pixel inset focus outline independent of selection.
- Hover: quiet neutral surface.
- Remove the current 3px selected-row inset stripe.
- Desktop row height: 28px target.
- Mobile row height: 44px minimum.
- Indentation remains compact but must preserve a consistent disclosure/icon
  column.
- Optional row actions appear on hover/focus for pointer layouts and remain in a
  mobile overflow menu.
- Directory loading uses a small disclosure-area indicator, not a text label
  that shifts the file name.
- Truncated directories show a terminal informational row that is not selectable.

## 9. Adapter Evolution

### 9.1 Milestone-one compatibility

Do not change `ThreadWorkspaceAdapter` for the model and interaction refactor.
Continue using:

- `listTree`
- `readFile`
- `getRawFileUrl`
- `uploadFile`
- `pickUploadFile`
- `writeFile`
- `downloadNode`
- `listGarbage`
- `emptyGarbage`
- `subscribeWorkspaceChanged`

### 9.2 Optional future capabilities

Add only optional methods so existing hosts remain source-compatible:

```ts
interface WorkspaceIdentity {
  threadId: string;
  workspaceId?: string | null;
}

interface ThreadWorkspaceChangedEvent {
  kind: 'created' | 'changed' | 'deleted' | 'moved' | 'unknown';
  path: string;
  previousPath?: string;
}

interface ThreadWorkspaceAdapter {
  createFile?(input: WorkspaceIdentity & { path: string }): Promise<void>;
  createDirectory?(input: WorkspaceIdentity & { path: string }): Promise<void>;
  moveNode?(input: WorkspaceIdentity & {
    fromPath: string;
    toPath: string;
    overwrite?: boolean;
  }): Promise<void>;
  deleteNode?(input: WorkspaceIdentity & {
    path: string;
    recursive?: boolean;
  }): Promise<void>;
  subscribeWorkspaceChanged?(
    input: WorkspaceIdentity,
    onChanged: (event?: ThreadWorkspaceChangedEvent) => void,
  ): (() => void) | void;
}
```

The callback must accept an omitted event during migration so current
implementations that emit only a generic invalidation remain valid.

### 9.3 Change-event policy

- Created or deleted item: refresh the parent directory.
- Changed file: reload preview only when selected and clean.
- Moved item: refresh old and new parents, then preserve selection at the new
  path when supplied.
- Unknown event: debounce a root refresh.
- Coalesce events by parent path over a short window.
- Never auto-reload an actively edited dirty buffer without a conflict prompt.

## 10. Detailed Migration Phases

Each phase should be a separately reviewable commit and leave all quality gates
green.

### Phase 0: Attribution and characterization tests

Deliverables:

- Add the project-level Code - OSS attribution mechanism if any verbatim source
  will be used.
- Pin the inspected VS Code commit in this document or a notice entry.
- Add characterization tests for existing path focus, lazy load, selection,
  refresh preservation, upload, download, and responsive activation behavior.
- Add `GraphWorkspaceExplorer.test.tsx` with a fake workspace adapter.

No user-visible behavior changes.

Exit criteria:

- Existing behavior is covered before extraction.
- The test records the number and arguments of `listTree` and `readFile` calls.
- Stale async completions can be controlled by deferred promises.

### Phase 1: Extract normalized model and projection

Deliverables:

- Add `workspaceExplorerTypes.ts`.
- Add `workspaceExplorerModel.ts` and focused tests.
- Add `workspaceExplorerProjection.ts` and focused tests.
- Convert the adapter tree to normalized records after every response.
- Keep the existing recursive presentation temporarily by adapting projected
  rows back to its props if necessary.
- Move generic lookup, ancestor, replacement, and flatten operations out of
  `workspaceTree.ts` when they are no longer domain-specific.

No intended user-visible behavior changes.

Exit criteria:

- Empty, unresolved, loading, resolved, error, and truncated directories are
  distinguishable in tests.
- Refresh preserves loaded descendants only when they still belong to the
  refreshed result.
- Selection and expansion survive a root refresh by path.
- A stale directory response cannot overwrite a newer response.

### Phase 2: Extract controller and persistence

Deliverables:

- Add `useWorkspaceExplorerController.ts`.
- Add `useWorkspaceExplorerPersistence.ts`.
- Move root loading, directory loading, refresh, expansion, selection, focus,
  focus-path reveal, and error state out of `GraphWorkspaceExplorer.tsx`.
- Add version-two persistence with version-one fallback.
- Remove manual multi-frame scroll restoration from the composition root; the
  tree component will own reveal and scroll offset.

No intended visual redesign yet.

Exit criteria:

- `GraphWorkspaceExplorer.tsx` no longer owns nested tree mutation logic.
- Controller hook tests cover workspace identity changes and request races.
- Malformed persisted data is ignored.
- Workspace change does not leak selection or expansion from the prior identity.

### Phase 3: Replace recursive tree with accessible virtualized tree

Deliverables:

- Add `@tanstack/react-virtual` to `packages/thread-ui` dependencies.
- Add `WorkspaceExplorerTree.tsx` and `WorkspaceExplorerRow.tsx`.
- Render flattened visible rows with stable keys.
- Implement `role="tree"`, `role="treeitem"`, ARIA levels, expanded state,
  selected state, labels, and set positions.
- Add roving focus and the keyboard command reducer.
- Keep secondary actions outside the primary row's tab order until the row is
  focused or its action menu is opened.
- Add deterministic scroll-to-index for focus requests and selected-path reveal.

User-visible behavior changes:

- Full keyboard navigation.
- Stable focus and selection treatment.
- Large expanded trees no longer render every visible DOM row.

Exit criteria:

- Keyboard matrix passes in jsdom.
- Screen-reader roles and state attributes are asserted.
- 10,000 projected rows render only a bounded number of DOM treeitems in a real
  browser smoke test.
- Mobile and desktop row heights remain stable during loading.

### Phase 4: Add toolbar, filter, collapse all, and compact folders

Deliverables:

- Add `WorkspaceExplorerToolbar.tsx` and `WorkspaceExplorerStatus.tsx`.
- Add inline filter with Highlight and Filter modes.
- Add Collapse All.
- Add compact-folder projection, enabled by default on desktop and disabled by
  default on mobile.
- Move garbage and future destructive actions into a More menu.
- Add result count and partial-loaded-tree messaging.

User-visible behavior changes:

- Faster tree navigation and less toolbar clutter.
- Familiar VS Code-style filtering and compact folder chains.

Exit criteria:

- Filter tests cover names, paths, ancestors, match ranges, and unresolved
  directories.
- Collapse All preserves the root and selection.
- Compact folders maintain correct ARIA labels and expansion targets.
- Escape restores the pre-filter expansion snapshot.

### Phase 5: Refine preview activation and line reveal

Deliverables:

- Make file-row activation select and load the Viewer in one action.
- On mobile, transition from Explorer to Viewer after file activation.
- Carry `focusPathRequest.line` into the preview target.
- Add line highlighting and scroll-to-line for source previews.
- Preserve Markdown preview/source choice only when appropriate for the current
  file.
- Keep single-Viewer semantics; do not add tabs in this phase.

Exit criteria:

- Chat-originated file links open the correct file and line.
- Mobile activation needs no hover-only Eye action.
- File selection does not collapse the desktop Explorer.
- Preview races cannot show content from the previously selected file.

### Phase 6: Optional file operations and live updates

Deliverables:

- Add optional create, directory-create, move, delete, and structured change
  event capabilities.
- Add inline rename with Enter commit and Escape cancel.
- Add capability-driven context menus and mobile action sheets.
- Subscribe to file changes and refresh only affected parents.
- Add dirty-buffer conflict handling before selected-file reload.

Host work is required in consuming repositories.

Exit criteria:

- Read-only hosts expose no write commands.
- Existing hosts compile without implementing new methods.
- Rename and delete update selection and focus predictably.
- Event storms are coalesced and do not reset scroll position.

### Phase 7: Pinned file tabs and desktop editor (complete)

Deliverables:

- Single click opens a replaceable preview tab.
- Double click or edit converts it to a pinned tab.
- Dirty tabs cannot be replaced or closed without confirmation.
- Tabs scroll horizontally when their combined width exceeds the editor.
- Desktop text files use the lazy Monaco editor and its dedicated web worker.
- Mobile defaults to one visible file and retains the lightweight source view.

## 11. Test Strategy

### 11.1 Pure unit tests

`workspaceExplorerModel.test.ts`:

- Normalize root and nested nodes.
- Resolve empty versus unresolved directories.
- Upsert directory children.
- Preserve unaffected loaded descendants.
- Remove stale descendants.
- Reject stale request generations.
- Preserve selection and expansion by path.
- Handle truncated directories.
- Handle synthetic nodes without applying workspace-only rules.

`workspaceExplorerProjection.test.ts`:

- Flatten expanded nodes in visual order.
- Directory-first sorting.
- ARIA level, position, and set size.
- Compact folder chains and all stopping conditions.
- Filtered matches plus ancestors.
- Stable visible-index mapping.

`workspaceExplorerCommands.test.ts`:

- Every key in the keyboard matrix.
- First and last row boundaries.
- Parent and first-child movement.
- Collapsed, expanded, empty, loading, and error directories.
- Input and modifier guards.

`workspaceExplorerFilter.test.ts`:

- Exact, prefix, subsequence, and path matches.
- Case folding.
- Match ranges.
- Stable ranking and deterministic ties.

### 11.2 Component tests

`WorkspaceExplorerTree.test.tsx`:

- ARIA contract.
- Roving focus.
- Pointer selection.
- Disclosure behavior.
- Loading and retry rows.
- Secondary action tab order.

`GraphWorkspaceExplorer.test.tsx`:

- Initial root load.
- Lazy directory expansion.
- Concurrent load deduplication.
- Stale response rejection.
- Refresh state preservation.
- Focus-path ancestor loading.
- Desktop versus mobile activation.
- Preview load and error isolation.
- Capability-driven toolbar actions.

Existing `GraphWorkspacePreviewPane.test.tsx`:

- Extend with source line reveal.
- Preserve Markdown, image, PDF, molecule, artifact, and edit coverage.

### 11.3 Playground and browser verification

Add a large generated mock workspace with:

- At least 10,000 projected visible nodes.
- Empty, loading, failed, and truncated directories.
- Deep single-directory chains.
- Long names and mixed file types.
- A focus request to a deep file and source line.

Verify at minimum:

- Desktop: 1440x900.
- Narrow desktop/tablet: 900x800.
- Mobile: 390x844.
- Light and dark themes.
- Keyboard-only navigation.
- Reduced-motion mode.
- Nonblank Viewer/plugin rendering after tree interactions.
- No overlap with thread controls or composer.

## 12. Performance And Bundle Budgets

- Workspace panel must remain lazy-loaded from `workspace-panel.js`.
- Do not move Explorer dependencies into the root `index.js` entry.
- Added minified JavaScript for the workspace panel should target less than 25
  kB excluding the virtualizer dependency.
- The virtualizer should remain isolated to the workspace-panel bundle.
- Root directory fetch count: one per workspace identity initialization.
- Directory expansion fetch count: at most one active request per path.
- File focus reveal: at most one fetch per unresolved ancestor.
- A refresh must not read file contents unless the selected preview requires it.
- Filter keystrokes should not trigger adapter calls in milestone four.
- Rendering 10,000 projected rows should keep DOM treeitems bounded by viewport
  plus overscan.
- No layout shift when a directory changes from unresolved to loading to loaded.

Record before-and-after values for:

- `packages/thread-ui/dist/workspace-panel.js` bytes.
- Playground workspace-related chunks.
- Initial workspace panel render time.
- Expand-to-visible latency for cached and uncached directories.
- DOM row count for the large fixture.

## 13. Accessibility Acceptance Criteria

- Tree is reachable with one Tab stop.
- Every visible selectable node has a correct accessible name.
- Directory rows expose expanded state.
- Selection and focus are conveyed independently in DOM and visual styling.
- Screen readers receive result counts, load failures, and retry completion.
- Compact folder rows announce the complete combined path and correct level.
- Icon-only buttons have accessible names and hover tooltips.
- Mobile touch targets meet the 44px minimum.
- Color is never the only indicator of selection, focus, loading, or error.
- Focus remains visible in light and dark themes.
- Reduced-motion users do not receive continuous refresh rotation.

## 14. Compatibility And Rollback

### 14.1 Public compatibility

- Do not remove or rename public package exports.
- Do not make new adapter methods required.
- Do not change `ThreadWorkspaceTreeNode` or `ThreadWorkspaceFilePreview` wire
  meaning during the initial refactor.
- Keep the workspace-panel secondary entrypoint.
- Keep source CSS imports available through the current public stylesheet.

### 14.2 Incremental rollout

During phases two through four, keep the old recursive tree available behind a
private implementation switch in the playground only. Do not add a permanent
user-facing setting. Remove the old path after:

- Model/controller tests pass.
- Browser checks pass at all target viewports.
- At least one consuming host has validated the new built `dist` output.

### 14.3 Rollback unit

Each phase is a separate commit. The public adapter remains compatible through
phase five, so any phase can be reverted without coordinating backend changes.
Phase six host changes require their own commits and feature detection.

## 15. Build And Validation Gates

Any change under `packages/thread-ui/src` must rebuild the package before host
validation because consumers may load `packages/thread-ui/dist/index.js` and
`packages/thread-ui/dist/workspace-panel.js`.

Required package checks after every implementation phase:

```bash
pnpm --filter @remote-codex/thread-ui typecheck
pnpm --filter @remote-codex/thread-ui lint
pnpm --filter @remote-codex/thread-ui test
pnpm --filter @remote-codex/thread-ui build
pnpm --filter @remote-codex/thread-ui-playground test
pnpm --filter @remote-codex/thread-ui-playground build
```

Required host checks after rebuilding and updating the consuming checkout:

```bash
pnpm --filter @remote-codex/thread-ui build
pnpm --filter @remote-codex/supervisor-web test
pnpm --filter @remote-codex/supervisor-web build
```

Run the relevant Android and iOS WebView checks when interaction or public
adapter behavior changes.

## 16. Definition Of Done

The refactor is complete when:

- `GraphWorkspaceExplorer.tsx` is a clear composition root rather than the tree
  state implementation.
- Tree model, projection, commands, filter, persistence, controller, and
  rendering have focused ownership and tests.
- Keyboard and screen-reader behavior matches the documented interaction spec.
- Collapse All, filter/highlight, compact folders, and reliable auto-reveal are
  available.
- Desktop and mobile activation paths are each intentional and tested.
- Refresh and async request races preserve correct selection, expansion, and
  preview state.
- Large visible trees are virtualized.
- Existing Viewer formats and plugin renderers still work.
- Existing adapters remain compatible through the first five phases.
- Built `dist` output is refreshed and consuming host tests pass.
- Any copied Code - OSS code is pinned, attributed, locally tested, and limited
  to an independently maintainable unit.

## 17. Recommended First Implementation Slice

Start with phases zero and one only:

1. Add characterization tests around the current component.
2. Add the normalized model and projection modules.
3. Route existing loaded trees through the new model.
4. Preserve the current rendered UI and public adapter contract.
5. Rebuild `@remote-codex/thread-ui` and verify the playground.

This slice creates the foundation for VS Code-like behavior while keeping the
first code review focused on data correctness rather than mixing architecture,
visual redesign, keyboard behavior, virtualization, and host API changes.
