# Bounded workspace document editor

This feature adds optional `resourceScopeKey`, `readDocument`, `saveDocument`, `getSaveOperation` and `textRangeRead` to `ThreadWorkspaceAdapter`. Existing adapters remain compatible and do not acquire conditional-save support through legacy `writeFile`. The host resource scope must distinguish origin, device and authenticated owner; workspace ID and server root revision also qualify document/model identity.

Each document retains its base snapshot, text, draft revision, edit state and save/conflict/unknown state in a shared browser memory store. The store is shared across host/lazy entry bundles with `Symbol.for`, bounded to 32 documents, and never evicts protected drafts. Monaco models preserve undo and view state across file switches; explicit discard, clean eviction and rename/delete release old models. A save settles only its submitted revision; later typing remains dirty. Failed writes retain drafts, and transport failures query the original operation receipt before accepting further writes.

Conflict comparisons use the receipt's fixed disk snapshot. Explicit overwrite submits that snapshot's hash and identity again; adopting it requires a fresh check before describing it as current disk. Diff views are read-only, lazy Monaco views. Downloads export text from the selected draft or snapshot. Pending/unknown writes cannot be discarded as though they were cancelled. The `pending` receipt retains protection and disables manual rebase until the operation finishes; durable `uncertain` permits an explicit checked-disk rebase without claiming the original operation ran.

Native unload protection survives a hidden/unmounted pane. The host uses `confirmWorkspaceDocumentLeave` for SPA/device/logout navigation. Drafts are memory-only; the navigation dialog supports cancel or explicit discard, while individual tabs support save-and-close. No persistent drafts, watcher or automatic merge is included.

The package exports `./workspace-editor.worker` so bundlers can create the worker explicitly. The Rust host imports it with Vite `?worker` and installs `MonacoEnvironment.getWorker`; this avoids a dependency optimizer rewriting package-local worker URLs.

Validation in this isolated UI worktree:

```bash
corepack pnpm --filter @remote-codex/thread-ui typecheck
corepack pnpm --filter @remote-codex/thread-ui exec vitest run src/components/graph-workspace/explorer/workspaceDocuments.test.ts src/i18n/i18n.test.tsx
corepack pnpm --filter @remote-codex/thread-ui build
```

All pass (3 draft-state tests and 9 i18n tests). Built tracked dist is included. The host refreshed its own file dependency and compared all 33 dist files by hash. Its selected browser tests cover real save/conflict receipts, A/B/A undo, hidden-pane unload protection, later typing during lost save responses and mobile actions. See the host's `docs/narrafork-file-editor-implementation.zh.md` for precise HTTP, filesystem limits and screenshots.
