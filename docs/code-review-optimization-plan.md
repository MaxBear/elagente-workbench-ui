# Pockymoe Thread UI Code Review And Optimization Plan

Date: 2026-06-10

Scope reviewed:

- Workspace configuration, package scripts, TypeScript and ESLint setup.
- `packages/thread-ui` public API, thread surface, timeline, composer, shell, graph chat, workspace, plugin provider, and CSS.
- `packages/plugin-runtime` artifact extraction and manifest handling.
- `packages/plugin-xyz-viewer` molecule renderer and package boundary.
- `packages/shared` DTO contract surface.
- `apps/playground` as the visual integration harness.

Existing working tree note:

- The repo already had modified generated files under `packages/plugin-xyz-viewer/dist/*` and a modified `packages/plugin-xyz-viewer/src/XyzMoleculeViewer.tsx` before this review. This document intentionally does not change those files.

## Validation Results

- Initial review: `pnpm typecheck` passed, `pnpm test` passed with only plugin-runtime coverage, and `pnpm lint` failed in `@remote-codex/thread-ui`.
- Current implementation checkpoint: full workspace `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass after the latest composer prompt slot split, shell socket side-effect split, secondary built-in plugin entrypoint, bundle-boundary changes, and playground smoke test.
- Current test coverage includes plugin-runtime artifact extraction plus thread-ui shell snapshot, shell presentation, shell terminal DOM helpers, shell state/control derivation, shell socket lifecycle decision helpers, shell socket side-effect application helpers, timeline item derivation, timeline scroll boundary helpers, timeline scroll/load-earlier hook behavior, timeline token formatting, request/activity note anchoring, deferred history detail loading, composer utility, composer presentation, contenteditable prompt helpers, composer draft-sync tests, composer prompt slot assembly, composer menu lifecycle tests, composer attachment preview URL lifecycle tests, extracted composer slash-panel tests, extracted composer shell tool controls, built-in plugin artifact/inline renderer smoke tests, and playground smoke coverage for render/menu, fake-adapter shell create/attach, plus timeline tail-follow and jump-to-latest behavior.

Implementation checkpoint completed on 2026-06-10:

- Restored lint to green without suppressing the relevant hook/dead-code issues.
- Fixed `plugin-runtime` package boundary imports to use `@remote-codex/shared`.
- Extracted shell snapshot/output utilities into `components/shell/shellSnapshot.ts` with focused tests.
- Extracted timeline item preparation/grouping/live-output utilities into `components/timeline/timelineItems.ts` with focused tests.
- Extracted timeline token and price formatting plus token summary UI into `components/timeline/tokenFormatting.tsx` with focused tests.
- Extracted request/activity note anchoring into `components/timeline/timelineAnchors.ts` with focused tests.
- Extracted timeline deferred history detail loading/cache/stale-response handling into `components/timeline/useDeferredHistoryDetail.ts` with focused tests.
- Extracted composer pure utilities into `components/composer/composerUtils.ts` with focused tests.
- Extracted composer controlled/uncontrolled draft synchronization into `components/composer/useComposerDraft.ts` with focused tests for deferred sync, immediate sync, host refresh, flush, and shell-mode behavior.
- Extracted composer labels, icon components, hook editability helpers, and context progress display into `components/composer/composerPresentation.tsx` with focused tests.
- Extracted composer control-label/disabled-state and className derivation into tested helpers in `components/composer/composerPresentation.tsx`, removing repeated conditional presentation logic from `ThreadComposer.tsx`.
- Extracted contenteditable clipboard/rich-text helpers plus serialized selection offset/restore behavior into `components/composer/contentEditablePrompt.ts` with jsdom tests.
- Extracted the chat prompt contenteditable view into `components/composer/ComposerPromptEditor.tsx`, keeping selection/draft/attachment mutation in `ThreadComposer.tsx` while reducing JSX nesting.
- Extracted composer fork/fork-turn slash panels into `components/composer/ComposerForkPanels.tsx` with jsdom render/click tests.
- Extracted composer skills slash panel into `components/composer/ComposerSkillsPanel.tsx` with jsdom render/copy/state tests, and moved `SlashPanelState` to `components/composer/types.ts` so child modules no longer import types from `ThreadComposer.tsx`.
- Extracted composer MCP slash panel into `components/composer/ComposerMcpPanel.tsx` with jsdom tests for server summaries, add choices, HTTP save, and raw block save flows.
- Extracted composer hooks slash panel into `components/composer/ComposerHooksPanel.tsx` with jsdom tests for list rendering, add/edit forms, trust/untrust, edit, and delete actions.
- Extracted composer attachment preview object URL lifecycle into `components/composer/useAttachmentPreviewUrls.ts` with jsdom tests for photo-only previews, URL reuse, removal cleanup, shell-view cleanup, and unmount cleanup.
- Moved attachment placeholder allocation, insertion spacing, and draft construction helpers into `components/composer/composerUtils.ts` with focused tests for duplicate suffixes and prompt insertion boundaries.
- Moved contenteditable selection snapshotting, attachment-chip placeholder serialization, DOM offset resolution, and post-insert caret restoration out of `ThreadComposer.tsx` into `components/composer/contentEditablePrompt.ts`, reducing the composer by another DOM-heavy block while expanding jsdom coverage.
- Moved paste/drop attachment insertion draft construction into `components/composer/composerUtils.ts`, covering selected-range replacement, caret placement, inserted attachment ids, duplicate placeholders, and drop ordering with focused tests.
- Extracted attachment insertion wiring into `components/composer/useComposerAttachments.ts`, centralizing picker/drop append actions, draft updates, selection refs, inserted attachment ids, and menu close callbacks with hook-level tests.
- Extracted the attachment picker toolbar menu into `components/composer/ComposerAttachmentMenu.tsx` with jsdom tests, reducing toolbar JSX in `ThreadComposer.tsx`.
- Extracted the composer model/effort/plan/send toolbar cluster into `components/composer/ComposerSettingsToolbar.tsx` with jsdom tests for model menu selection, effort selection, plan toggling, active plan state, and send disabled-state behavior. `SettingsMenu` now lives in `components/composer/types.ts` so the main composer and toolbar share one menu-state contract.
- Extracted the slash toolbox trigger, root item list, panel shell, and panel routing into `components/composer/ComposerSlashToolboxMenu.tsx` with jsdom tests for trigger visibility, root item forwarding, empty state, fork-turn routing, and skill-copy forwarding. `SlashPanelView` now lives in `components/composer/types.ts`.
- Extracted the goal compose token-budget/error/cancel card into `components/composer/ComposerGoalComposeCard.tsx` with jsdom tests for input rendering, change forwarding, local error display, and cancel behavior.
- Extracted mobile shell tools popover into `components/composer/ComposerShellToolsPanel.tsx` with jsdom tests for paste/copy/clear/control actions and disabled-state behavior.
- Extracted the shell-mode prompt textarea, interrupt button, and shell submit button into `components/composer/ComposerShellPromptInput.tsx` with jsdom tests for text/key forwarding, interrupt disabled/enabled behavior, send disabled state, and focus-preserving pointer guards.
- Extracted composer prompt, goal-card, and shell-prompt slot assembly into `components/composer/useComposerPromptSlots.tsx`, removing the remaining prompt JSX prop wiring from the main composer return path while keeping event side effects in `ThreadComposer.tsx`. Added jsdom coverage for chat/goal rendering, shell rendering, input forwarding, key forwarding, and inactive slot nulling.
- Extracted slash toolbox action decisions, status, disabled-state, and active class derivation into `components/composer/composerToolbox.ts` with focused tests for fast, compact, goal, fork, panel routing, and view-only actions.
- Extracted composer submit input derivation into `components/composer/composerUtils.ts`, preserving shell prompt whitespace, non-shell prompt trimming, empty non-shell suppression, and active attachment filtering with focused tests.
- Extracted prompt paste, file drag/drop, and keyboard submit shortcut decisions into `components/composer/composerUtils.ts`, leaving `ThreadComposer.tsx` responsible only for event side effects while covering files, text/HTML paste fallback, drag/drop acceptance, and busy/disabled shortcut handling with focused tests.
- Extracted composer settings update optimistic-mode and rollback decisions into `components/composer/composerUtils.ts`, covering collaboration-mode updates, no-mode updates, and rollback-to-null behavior with focused tests.
- Extracted hidden attachment file inputs into `components/composer/ComposerHiddenAttachmentInputs.tsx` with jsdom tests for photo/file forwarding and input reset behavior.
- Extracted the jump-to-latest composer overlay button into `components/composer/ComposerJumpLatestButton.tsx` with jsdom tests for chat-only rendering, click forwarding, and active follow-tail styling.
- Extracted contenteditable prompt DOM synchronization into `components/composer/useComposerPromptDomSync.ts`, moving attachment-chip DOM construction, preview signature tracking, sanitize nonce handling, and post-insert selection restoration out of `ThreadComposer.tsx`.
- Extracted goal compose state and submission orchestration into `components/composer/useComposerGoal.ts` with hook-level jsdom tests for enter/focus behavior, seeded token budgets, empty-objective rejection, invalid-budget rejection, successful submit/draft reset, and backend error display.
- Extracted MCP provider-config editing orchestration into `components/composer/useComposerMcpConfig.ts` with hook-level jsdom tests for invalid HTTP names/URLs, HTTP MCP block writes, raw block preparation, provider-config unavailability, malformed raw blocks, raw MCP block writes, status clearing, path tracking, and MCP refresh callbacks.
- Extracted fork latest/turn side-effect orchestration into `components/composer/useComposerForkActions.ts` with hook-level jsdom tests for missing handlers, busy-state transitions, successful menu close behavior, failure recovery without menu close, and clearing busy when leaving the fork-turns panel.
- Extracted hook configuration form state and side-effect orchestration into `components/composer/useComposerHookConfig.ts` with hook-level jsdom tests for command-template defaults, event-driven matcher/command updates, editable-hook loading, validation, create/update success, trust/untrust success and unavailable-handler errors, status reset when leaving the hooks panel, and fallback command behavior.
- Extracted composer menu lifecycle side effects into `components/composer/useComposerMenuLifecycle.ts`, covering slash-menu reset behavior, MCP config-status cleanup, copied skill-name feedback timeout, and outside-click menu dismissal with hook-level jsdom tests.
- Extracted timeline request/activity card sections into `components/timeline/TimelineRequestCards.tsx`, removing repeated mapping/sorting JSX from the public timeline component.
- Extracted timeline turn status and live-plan display into `components/timeline/turnStatus.tsx` with focused tests for displayed live-plan derivation and step status normalization.
- Extracted timeline history item rows, grouped history rendering, and turn row composition into `components/timeline/TimelineTurnRows.tsx`, reducing the public `ThreadTimeline.tsx` to scroll/state/data orchestration.
- Extracted timeline scroll constants, near-bottom/visibility helpers, and synthetic live-turn construction into `components/timeline/timelineScroll.ts` with focused tests for scroll thresholds, sentinel visibility, timestamp inference, and live turn fallback construction.
- Extracted timeline scroll/load-earlier/tail-follow orchestration into `components/timeline/useTimelineScroll.ts` with jsdom tests for local history pagination, server-managed load-earlier delegation, and tail visibility notifications.
- Extracted shell label/theme/icon presentation helpers into `components/shell/shellPresentation.tsx` with focused tests.
- Extracted xterm snapshot rendering and visible-row text reading into `components/shell/shellTerminal.ts` with jsdom tests.
- Extracted shell state/control derivation into `components/shell/shellState.ts` with tests for live/attachable shell detection, initial active shell selection, connection button state, runtime state equality, and public control-state construction.
- Extracted the single-pane xterm/socket UI into `components/shell/ShellPane.tsx`, leaving `ThreadShellPanel.tsx` focused on shell list state, split-pane layout, active-pane routing, and the floating toolbox.
- Extracted shell socket output payload normalization and snapshot/last-command-output updates into `components/shell/shellEvents.ts` with focused tests, reducing the size of the `ShellPane.tsx` socket event callback before a deeper socket hook extraction.
- Extracted shell lifecycle event action derivation into `components/shell/shellEvents.ts`, covering connected/error/viewer-conflict/detached/replaced/exited/status events with focused tests before moving the full socket controller.
- Extracted shell reconnect scheduling and detach-message decision helpers into `components/shell/shellEvents.ts`, covering manual disconnect, intentional close, and missing viewer/shell-id cases with focused tests.
- Extracted shell attach-timeout decision logic into `components/shell/shellEvents.ts`, covering stale socket, already-attached viewer, and timeout-close cases with focused tests.
- Centralized shell timer delay constants and attach-retry scheduling policy in `components/shell/shellEvents.ts`, replacing scattered retry/reconnect/timeout magic numbers in `ShellPane.tsx`.
- Extracted shell resize backend-sync decision logic into `components/shell/shellEvents.ts`, covering disabled backend sync, unchanged size suppression, missing shell/viewer ids, and resize message construction with focused tests.
- Extracted imperative shell reconnect request decision logic into `components/shell/shellEvents.ts`, covering unavailable shell/terminal/workspace states, already-attached viewers, pending attach promise joining, and new attach starts with focused tests.
- Extracted shell socket close cleanup/reconnect decision logic into `components/shell/shellEvents.ts`, covering stale sockets, detach updates, automatic reconnects without an attached viewer, intentional disconnects, and user-disconnected shell suppression with focused tests.
- Extracted shell socket open attach-message construction into `components/shell/shellEvents.ts`, covering stale sockets and `shell.attach` payload construction from the measured terminal size with focused tests.
- Extracted shell attach-start guard/retry/reuse/start decision logic into `components/shell/shellEvents.ts`, preserving the original terminal-size measurement order while covering skip, delayed retry, existing-socket reuse, reconnect-timer clearing, and start-attach actions with focused tests.
- Extracted shell socket timer and cleanup side-effect application into `components/shell/shellSocketSideEffects.ts`, centralizing timer ref clearing, attach retry scheduling, reconnect scheduling, attach-timeout close handling, socket-close state application, and socket cleanup application. Added jsdom/fake-timer tests for timeout close behavior, stale/already-attached timeout suppression, close detach/reconnect application, cleanup detach/close application, and cleanup derivation from mutable refs.
- Extracted manual shell disconnect cleanup decisions into `components/shell/shellEvents.ts`, covering detach-message sending, socket closing, shell status updates, and missing shell/viewer cases with focused tests.
- Extracted shell socket effect cleanup decisions into `components/shell/shellEvents.ts`, covering intentional disconnects, attach retry/timeout timer cleanup, OPEN-only detach sends, stale socket-ref handling, and missing viewer cases with focused tests.
- Extracted shell reconnect start state-reset decisions into `components/shell/shellEvents.ts`, covering user-disconnect marker clearing, intentional-disconnect reset, connection-error clearing, connecting state, and reconnect-key increments with focused tests.
- Extracted shell missing-session reset and pane-unmount timer cleanup decisions into `components/shell/shellEvents.ts`, covering viewer/connection/prompt/command snapshot clearing, terminal reset intent, reconnect timer cleanup, attach timeout cleanup, attach retry cleanup, and attach-promise settling with focused tests.
- Extracted the shell attach-promise waiter/timer controller into `components/shell/shellAttachPromise.ts`, covering pending joins, settle resolution, timeout failure, timer cleanup, and clear-without-resolve behavior with focused tests.
- Added a first `ShellPane` fake-adapter jsdom test covering xterm/FitAddon mocks, measured terminal-size attach messages, socket `onConnected`, and `shell.connected` shell-update handling.
- Extended `ShellPane` fake-adapter coverage to manual disconnect, asserting `shell.detach` sends, socket close calls, and detached shell updates after an attached viewer is present.
- Extended `ShellPane` fake-adapter coverage to reconnect after manual disconnect, asserting a second socket attach and promise resolution; this also fixed stale socket cleanup so it no longer settles a newer pending reconnect promise.
- Extended `ShellPane` fake-adapter coverage to unexpected socket close, asserting detached shell updates and automatic reconnect scheduling after the reconnect delay.
- Extended `ShellPane` fake-adapter coverage to attach timeout handling, asserting that a socket which opens but never emits `shell.connected` sends the measured attach payload, closes on `SHELL_ATTACH_TIMEOUT_MS`, and reports the timeout runtime error.
- Extended `ShellPane` fake-adapter coverage to backend terminal resize synchronization, asserting `refreshLayout({ syncBackendSize: true })` sends a `shell.resize` message with the current viewer id and changed xterm dimensions.
- Split `packages/thread-ui/src/styles.css` into smaller imported domain files while preserving the public `./styles.css` entry.
- Moved `packages/plugin-xyz-viewer` React runtime declarations from `dependencies` to peer plus dev dependencies.
- Added a `@remote-codex/plugin-xyz-viewer/manifest` export and changed thread-ui built-in plugin registration to import the XYZ manifest from that lightweight subpath.
- Lazy-loaded the XYZ molecule viewer frontend and stylesheet from `xyz-plugin-renderers.tsx` so molecule rendering code is fetched only when an XYZ artifact or inline molecule block is expanded/rendered.
- Moved thread-ui built-in plugin modules and XYZ renderer exports behind the secondary `@remote-codex/thread-ui/builtin-plugins` entrypoint. `PluginProvider` now accepts `builtinPlugins` and defaults to no built-ins, so chat-only root-entry consumers do not statically import built-in XYZ/terminal modules unless they opt in. The playground now imports that secondary entry explicitly.
- Moved the heavy graph workspace panel implementation behind a secondary `@remote-codex/thread-ui/workspace-panel` entrypoint and changed the root entry to export a lazy wrapper. `ThreadDetailSurface` now loads the default workspace panel through that lazy boundary, while consumers that need a static workspace-panel import can opt into the secondary entry explicitly.
- Added playground Vite manual chunk boundaries for React, thread-ui core, workspace panel, xterm, React Flow, markdown, icons, plugins, and 3Dmol. The playground entry chunk is now about 393 kB minified instead of roughly 1.35 MB, the workspace panel is isolated around 89 kB, and the only remaining oversized chunk is the isolated lazy `vendor-3dmol` dependency at about 588 kB.
- Added a playground-only Rollup warning filter for the known upstream `3dmol` eval warning. All `3dmol` distributed builds in `3dmol@2.5.5` contain the same callback-string `eval` helper, so switching from the package main entry to an ES/minified entry would not remove the underlying warning and risks weakening package/type compatibility. The filter is scoped to `warning.code === 'EVAL'` and ids under `/3dmol/`; other warnings still fail through the normal handler.
- Extended the playground harness to wire `timelineProps.onTailVisibilityChange`, composer `followTail`, and `onToggleFollow`, then added a second jsdom smoke test that simulates timeline scroll geometry, verifies the jump-to-latest badge leaves the active state when the tail is out of view, and verifies clicking it requests a tail jump and restores the active state.
- Added a lightweight playground shell adapter and extended the playground smoke test from shell fallback coverage to the real `ThreadShellPanel` path: initial not-created state, create-shell action, fake socket attach, visible live process count, shell label, and cwd/status display. The smoke test now also mocks canvas `getContext` so jsdom does not emit WebGL probe noise while the XYZ artifact panel is visible.
- Added a built-in plugin rendering smoke test in `components/plugins/builtin-plugin-rendering.test.tsx`, covering XYZ artifact renderer routing, renderer availability detection, inline XYZ renderer shell rendering for valid molecule code, invalid molecule rejection, and avoiding WebGL/3Dmol loading by keeping artifact rendering collapsed.

Current large-file sizes after the checkpoint:

- `ThreadComposer.tsx`: 1,013 lines.
- `ThreadTimeline.tsx`: 600 lines.
- `ThreadShellPanel.tsx`: 1,122 lines.
- `ThreadDetailSurface.tsx`: 452 lines.
- `components/ThreadGraphWorkspacePanelLazy.tsx`: 42 lines.
- `workspace-panel.ts`: 7 lines.
- `apps/playground/src/PlaygroundApp.tsx`: 266 lines.
- `apps/playground/src/playgroundSmoke.test.tsx`: 325 lines.
- `plugins/builtin-plugin-rendering.test.tsx`: 126 lines.
- `components/composer/composerUtils.ts`: 638 lines.
- `components/composer/composerUtils.test.ts`: 499 lines.
- `components/composer/ComposerHiddenAttachmentInputs.tsx`: 46 lines.
- `components/composer/ComposerJumpLatestButton.tsx`: 42 lines.
- `components/composer/composerToolbox.ts`: 129 lines.
- `components/composer/contentEditablePrompt.ts`: 267 lines.
- `components/composer/useComposerAttachments.ts`: 116 lines.
- `components/composer/ComposerSlashToolboxMenu.tsx`: 321 lines.
- `components/composer/ComposerSettingsToolbar.tsx`: 232 lines.
- `components/composer/ComposerGoalComposeCard.tsx`: 42 lines.
- `components/composer/ComposerAttachmentMenu.tsx`: 61 lines.
- `components/composer/ComposerShellPromptInput.tsx`: 78 lines.
- `components/composer/ComposerFrame.tsx`: 89 lines.
- `components/composer/ComposerFrame.test.tsx`: 91 lines.
- `components/composer/ComposerToolbar.tsx`: 134 lines.
- `components/composer/ComposerToolbar.test.tsx`: 118 lines.
- `components/composer/useComposerToolbarProps.ts`: 423 lines.
- `components/composer/useComposerToolbarProps.test.ts`: 159 lines.
- `components/composer/useComposerPromptSlots.tsx`: 132 lines.
- `components/composer/useComposerPromptSlots.test.tsx`: 189 lines.
- `components/composer/useComposerPromptDomSync.ts`: 201 lines.
- `components/composer/useComposerGoal.ts`: 142 lines.
- `components/composer/useComposerGoal.test.tsx`: 220 lines.
- `components/composer/useComposerMcpConfig.ts`: 219 lines.
- `components/composer/useComposerMcpConfig.test.tsx`: 214 lines.
- `components/composer/useComposerForkActions.ts`: 68 lines.
- `components/composer/useComposerForkActions.test.tsx`: 167 lines.
- `components/composer/useComposerMenuLifecycle.ts`: 115 lines.
- `components/composer/useComposerMenuLifecycle.test.tsx`: 197 lines.
- `components/composer/useComposerSettingsActions.ts`: 62 lines.
- `components/composer/useComposerSettingsActions.test.tsx`: 152 lines.
- `components/composer/useComposerHookConfig.ts`: 351 lines.
- `components/composer/useComposerHookConfig.test.tsx`: 310 lines.
- `components/shell/ShellPane.tsx`: 730 lines.
- `components/shell/useShellSocketLifecycle.ts`: 407 lines.
- `components/shell/shellSocketSideEffects.ts`: 246 lines.
- `components/shell/shellSocketSideEffects.test.ts`: 332 lines.
- `components/shell/shellSocketLifecycle.ts`: 242 lines.
- `components/shell/shellSocketLifecycle.test.ts`: 285 lines.
- `components/shell/ShellPane.test.tsx`: 440 lines.
- `components/shell/shellEvents.ts`: 695 lines.
- `components/shell/shellEvents.test.ts`: 861 lines.
- `components/shell/shellAttachPromise.ts`: 72 lines.
- `components/shell/shellAttachPromise.test.ts`: 90 lines.
- `components/composer/useAttachmentPreviewUrls.ts`: 70 lines.
- `components/composer/ComposerShellToolsPanel.tsx`: 122 lines.
- `components/composer/ComposerPromptEditor.tsx`: 111 lines.
- `components/composer/ComposerForkPanels.tsx`: 117 lines.
- `components/composer/ComposerSkillsPanel.tsx`: 95 lines.
- `components/composer/ComposerMcpPanel.tsx`: 258 lines.
- `components/composer/ComposerHooksPanel.tsx`: 359 lines.
- `components/shell/shellState.ts`: 158 lines.
- `components/timeline/TimelineTurnRows.tsx`: 590 lines.
- `components/timeline/turnStatus.tsx`: 327 lines.
- `components/timeline/timelineScroll.ts`: 62 lines.
- `components/timeline/useTimelineScroll.ts`: 381 lines.
- `styles.css`: 6-line public import aggregator, backed by domain CSS files under `src/styles/`.

Current targeted thread-ui validation:

- `pnpm --filter @remote-codex/thread-ui typecheck`: pass.
- `pnpm --filter @remote-codex/thread-ui lint`: pass.
- `pnpm --filter @remote-codex/thread-ui test`: pass, 46 files / 237 tests.
- `pnpm --filter @remote-codex/plugin-xyz-viewer build`: pass and emits the new manifest subpath artifacts.
- `pnpm --filter @remote-codex/thread-ui build`: pass with the lazy XYZ frontend import preserved in the built output.
- `pnpm --filter @remote-codex/thread-ui-playground test`: pass, 2 jsdom smoke tests covering playground render, timeline/composer presence, slash menu opening, fake-adapter shell create/attach, and timeline tail-follow/jump-to-latest behavior from mocked scroll geometry.
- Browser smoke: started the playground dev server at `http://localhost:5174/`, opened it through Chrome DevTools, verified the page rendered with nonblank timeline/workspace/plugin content, clicked the shell creation path, and confirmed the fake-adapter shell reached visible live/running state.
- Browser plugin smoke: in Chrome DevTools on `http://localhost:5174/`, verified the expanded XYZ artifact panel in a WebGL-capable browser, one visible 3Dmol canvas, no WebGL fallback/error text, and a canvas PNG sample with non-background pixels (`dataUrlLength` 63,174; 62 non-background samples out of about 2,003 sampled pixels). This confirms the plugin renders a real molecule canvas in the browser, not just the surrounding panel shell.
- `pnpm --filter @remote-codex/thread-ui-playground build`: pass. The previous Vite large-chunk warning is gone after isolating thread-ui/workspace/vendor chunks and setting the playground warning limit to 600 kB for the lazy 3Dmol vendor chunk. The playground config now suppresses only the known upstream `3dmol` Rollup `EVAL` warning; the source dependency still contains `eval`, but the example app no longer emits that warning during every build.
- Build artifact check: `packages/thread-ui/dist/index.js` no longer contains `plugin-xyz-viewer`, `XyzArtifactRenderer`, `builtinFrontendPlugins`, or `LazyXyzMoleculeViewer`; those symbols are isolated in `packages/thread-ui/dist/builtin-plugins.js`.
- Build artifact check: `packages/thread-ui/dist/index.js` now references `import("./workspace-panel.js")` for the workspace panel lazy boundary, while `@xyflow/react`, `GraphWorkspaceExplorer`, and graph workspace implementation code live in `packages/thread-ui/dist/workspace-panel.js`.

Current full workspace validation:

- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass.
- `pnpm build`: pass after the playground-scoped `3dmol` warning filter; no remaining workspace build warnings are expected from the optimization changes.

Remaining follow-up work:

- Continue splitting `ThreadComposer.tsx` into smaller orchestration hooks. Attachment object URL lifecycle, contenteditable selection/restore behavior, contenteditable DOM synchronization, paste/drop insertion draft construction, submit input derivation, paste/drag/drop/keyboard decisions, settings optimistic-mode decisions, settings update wiring, hidden attachment inputs, jump-to-latest overlay, attachment append wiring, attachment picker menu, model/effort/plan/send toolbar controls, slash toolbox shell/routing, toolbox action/status/class derivation, goal compose state/submission, MCP provider-config editing, fork latest/turn actions, hook configuration state/actions, menu lifecycle side effects, goal compose card, shell prompt controls, mobile shell tools, toolbar composition shell, toolbar prop assembly, prompt/goal/shell slot assembly, and outer composer frame are now isolated and tested; the remaining composer work is primarily reducing prompt input/paste/drag-drop event side-effect handlers and final submit orchestration in the main component.
- Continue hardening timeline scroll behavior with a dedicated real-browser scroll assertion if the playground adopts Playwright or another browser smoke runner. Scroll/load-earlier/tail-follow orchestration, scroll constants, request/activity cards, anchoring, turn status, and turn/history row rendering are now separate, and playground smoke now covers the scroll-geometry-to-follow-tail-to-jump interaction in jsdom.
- Continue hardening shell terminal lifecycle with deeper browser interactions around reconnect/disconnect controls. `ThreadShellPanel.tsx` is now an orchestration component, while presentation, terminal DOM helpers, shell state/control derivation, socket output parsing, lifecycle event action derivation, reconnect/detach policy, attach-start guard/retry/reuse policy, socket-open attach-message policy, socket-close reconnect policy, socket cleanup policy, socket side-effect application, imperative reconnect request policy, attach-timeout policy, attach-retry timing policy, resize sync policy, missing-session reset policy, unmount timer cleanup policy, snapshot update logic, single-pane terminal UI, socket lifecycle hook, socket event application helpers, and attach/open/close/cleanup application helpers are separate; component-level fake-adapter coverage now includes attach, manual disconnect, reconnect, unexpected close, attach timeout, and backend resize sync, while playground smoke covers the app-level fake-adapter create/attach path.
- Continue hardening plugin bundle boundaries as new host apps appear. Built-ins and XYZ renderers now live behind `@remote-codex/thread-ui/builtin-plugins`, the graph workspace panel lives behind `@remote-codex/thread-ui/workspace-panel`, the XYZ viewer/CSS are lazy-loaded, the manifest is available through a lightweight subpath, and the playground isolates/suppresses the known 3Dmol dependency warning locally. Remaining work is dependency-level upstream 3Dmol policy only, not a local bundle-blocking issue.
- Convert the manual Chrome DevTools WebGL/plugin smoke into an automated Playwright-style smoke if the repo later adds browser test infrastructure. Playground jsdom smoke now covers render/menu, shell create/attach, and timeline tail-follow/jump-to-latest behavior, thread-ui jsdom smoke covers built-in plugin artifact/inline renderer routing without loading WebGL, manual browser smoke confirms real WebGL canvas output, and `ShellPane` jsdom fake-adapter coverage exercises the high-risk shell lifecycle branches.

Historical initial lint failures and warnings from the first scan:

Current lint failures and warnings worth fixing before broad refactors:

- `packages/thread-ui/src/components/ThreadTimeline.tsx`: unused `GraphChatMarkdownAwareBody`, `ContextCompactionHistoryItem`, `normalizeLines`, `CompactMessageIcon`.
- `packages/thread-ui/src/components/ThreadWorkspaceLayout.tsx`: unused destructured props `showMobileAppMenu`, `showMobileThreadNavToggle`, `appMenuButton`, `appNavigationMenu`.
- `packages/thread-ui/src/components/graph-chat/FloatingHelper.tsx`: multiple explicit `any` types.
- `packages/thread-ui/src/components/graph-chat/GraphChatThreadChatPanel.tsx`: unused `isTailVisible` and `contentRevision`.
- `packages/thread-ui/src/components/graph-chat/GraphVisualization.tsx`: explicit `any` types.
- `packages/thread-ui/src/components/graph-workspace/GraphWorkspaceExplorer.tsx`: `objectUrl` should be `const`.
- `packages/thread-ui/src/components/graph-workspace/GraphWorkspacePreviewPane.tsx`: unused `ThreadArtifactDto`.
- Hook dependency warnings in `ThreadDetailSurface.tsx`, `ThreadComposer.tsx`, and `ThreadShellPanel.tsx`.
- Fast refresh warnings in small graph UI modules that export non-component helpers/constants from component files.

## Executive Summary

The codebase is type-safe enough to compile, but `thread-ui` has accumulated several very large components that mix domain normalization, async orchestration, DOM measurement, browser APIs, and rendering. The biggest optimization opportunity is not micro-performance. It is reducing the amount of logic that re-runs during React renders and extracting pure functions/hooks so the risky behavior can be tested independently.

Highest priority work:

1. Restore lint to green. This is the cheapest quality gate and will make later refactors safer.
2. Split `ThreadComposer.tsx`, `ThreadTimeline.tsx`, `ThreadShellPanel.tsx`, and `styles.css`.
3. Move pure timeline/composer/shell utilities into separate modules with Vitest coverage.
4. Fix package boundary issues in `plugin-runtime`, especially imports from `../../shared/src/index`.
5. Revisit bundle boundaries: `thread-ui` directly bundles built-in plugins and 3Dmol paths, which may be heavier than necessary for consumers that only need chat.

## Priority 0: Quality Gate Cleanup

### P0.1 Make `pnpm lint` pass

Files:

- `packages/thread-ui/src/components/ThreadTimeline.tsx`
- `packages/thread-ui/src/components/ThreadWorkspaceLayout.tsx`
- `packages/thread-ui/src/components/graph-chat/FloatingHelper.tsx`
- `packages/thread-ui/src/components/graph-chat/GraphChatThreadChatPanel.tsx`
- `packages/thread-ui/src/components/graph-chat/GraphVisualization.tsx`
- `packages/thread-ui/src/components/graph-workspace/GraphWorkspaceExplorer.tsx`
- `packages/thread-ui/src/components/graph-workspace/GraphWorkspacePreviewPane.tsx`

Recommended action:

- Remove unused imports/types/functions first.
- Replace `any` in React Flow helpers with the closest `@xyflow/react` node/edge types or a local minimal structural type.
- Change the `let objectUrl` case to `const`.
- Decide whether fast refresh warnings matter for the library. If they do, move variant constants/helpers out of component files. If they do not, narrow the lint rule for package library code.

Why it matters:

- Current lint failures hide new issues during refactors.
- The unused code in `ThreadTimeline.tsx` and `ThreadWorkspaceLayout.tsx` suggests previous UI rewrites left dead paths behind.

### P0.2 Resolve hook dependency warnings by stabilizing callbacks, not by suppressing rules

Files:

- `packages/thread-ui/src/ThreadDetailSurface.tsx`
- `packages/thread-ui/src/components/ThreadComposer.tsx`
- `packages/thread-ui/src/components/ThreadShellPanel.tsx`

Recommended action:

- In `ThreadComposer.tsx`, wrap draft sync functions in `useCallback` or extract draft synchronization into `useComposerDraft`.
- In `ThreadShellPanel.tsx`, include `shellAdapter` in the socket effect dependency list only after confirming reconnection behavior, or hold it in a ref if adapter identity is intentionally external and stable.
- In `ThreadDetailSurface.tsx`, inspect the memo around line 230 and either include `adapter` or destructure stable adapter methods before the memo.

Why it matters:

- These warnings occur in async/browser-integration code. Stale closures here can lose drafts, connect to old sockets, or render stale adapter behavior.

## Priority 1: Large File Splits

### P1.1 Split `ThreadComposer.tsx`

Current size: about 4,154 lines.

Observed responsibilities:

- Public `ThreadComposerProps` contract.
- Controlled/uncontrolled draft synchronization.
- Contenteditable prompt serialization and selection restoration.
- Attachment creation, paste/drop extraction, preview object URL lifecycle.
- Slash toolbox root menu.
- Skills, MCP, hooks, fork, and goal panels.
- Model/effort/context controls.
- Chat mode and shell mode rendering variants.
- Shell control passthrough.

Recommended split:

- `components/composer/ThreadComposer.tsx`: public wrapper and final layout composition.
- `components/composer/types.ts`: `ThreadComposerProps`, `SlashPanelState`, draft and attachment types.
- `components/composer/useComposerDraft.ts`: controlled/uncontrolled draft state, deferred host sync, flush on unmount/blur.
- `components/composer/useComposerAttachments.ts`: file classification, placeholder allocation, object URL cache, paste/drop helpers.
- `components/composer/contentEditablePrompt.ts`: pure prompt tokenization, DOM offset measurement, serialization helpers. Keep DOM-dependent functions small and tested with jsdom.
- `components/composer/ComposerPromptEditor.tsx`: contenteditable UI and selection lifecycle.
- `components/composer/ComposerToolbar.tsx`: send/interrupt/follow/model/effort controls.
- `components/composer/SlashToolboxMenu.tsx`: menu shell and routing.
- `components/composer/SkillsPanel.tsx`
- `components/composer/McpPanel.tsx`
- `components/composer/HooksPanel.tsx`
- `components/composer/ForkPanel.tsx`
- `components/composer/GoalPanel.tsx`

Near-term extraction candidates:

- `tokenizePrompt`, `draftSignature`, attachment name normalization, placeholder allocation, TOML MCP block helpers, goal budget parse/format helpers.
- These are already pure enough to move without changing behavior.

Optimization impact:

- Reduces React render churn by letting menu panels memoize independently.
- Makes attachment object URL lifecycle testable and easier to reason about.
- Prevents the contenteditable editor from being coupled to backend management panels.

Risk:

- High. Contenteditable selection and controlled draft sync are easy to regress.

Required tests before/with split:

- `tokenizePrompt` with duplicate/overlapping attachment placeholders.
- Attachment placeholder uniqueness.
- Paste HTML conversion to plain text.
- Drag/drop ordering of photo/file attachments.
- Controlled draft: deferred sync, immediate submit sync, blur flush, unmount flush.
- Goal token budget parser.
- MCP TOML block upsert behavior.

### P1.2 Split `ThreadTimeline.tsx`

Current size: about 3,666 lines.

Observed responsibilities:

- Live item merging and ordering.
- Hook prompt XML-ish parsing.
- Reasoning attachment to agent messages.
- Consecutive history item grouping.
- Runtime/token/cost formatting.
- Turn row rendering.
- Pending request/activity note anchoring.
- Deferred detail loading and caching.
- Scroll anchoring, tail-follow, load earlier behavior, ResizeObserver and IntersectionObserver.
- Main timeline rendering.

Recommended split:

- `components/timeline/ThreadTimeline.tsx`: public wrapper.
- `components/timeline/types.ts`: local timeline entry/turn types.
- `components/timeline/timelineItems.ts`: `prepareTurnItemsForRendering`, `sortTurnItemsByRecordedSequence`, `mergeLiveTurnItems`, `groupTimelineHistoryItems`.
- `components/timeline/liveOutput.ts`: `getLiveOutputTailForTurn`, hook prompt parsing.
- `components/timeline/tokenFormatting.tsx`: token/cost calculations and badge metadata. Keep icons in separate component file if JSX is required.
- `components/timeline/useTimelineScroll.ts`: tail-follow, load earlier, scroll preservation.
- `components/timeline/useDeferredHistoryDetail.ts`: detail cache and stale request handling.
- `components/timeline/ThreadTurnRow.tsx`
- `components/timeline/TimelineHistoryEntries.tsx`
- `components/timeline/PendingRequestCard.tsx`
- `components/timeline/ActivityNoteCard.tsx`

Optimization impact:

- Pure item preparation can be memoized by `(turn.items, liveItems, active)` instead of recalculating inside row renders.
- Scroll effects become easier to audit and less likely to fire from unrelated prop changes.
- Token formatting can be tested without rendering the full timeline.

Risk:

- Medium to high. The timeline has many edge cases around live output, optimistic turns, and scroll position.

Required tests:

- Sequence sorting with leading unsequenced user messages.
- Grouping consecutive command/file/search/read items.
- Reasoning items before and after agent messages.
- Live item merge preserving `detailText`, `previewText`, `status`, and `sequence`.
- Live output tail deduction when backend streams partial agent text.
- Hook prompt parsing with entity decoding.
- Activity/request note anchoring before, after, leading, and trailing.

### P1.3 Split `ThreadShellPanel.tsx`

Current size: about 2,408 lines.

Observed responsibilities:

- xterm initialization and theme setup.
- WebSocket attach/detach/reconnect protocol.
- Terminal snapshot rendering.
- Shell command output extraction.
- Split pane state.
- Mobile shell state.
- Shell process/session management.
- Floating toolbox feedback and controls.
- Public imperative handle.

Recommended split:

- `components/shell/ThreadShellPanel.tsx`: public orchestration and layout.
- `components/shell/ShellPane.tsx`: single pane terminal and socket lifecycle.
- `components/shell/useShellSocket.ts`: attach/reconnect/detach protocol.
- `components/shell/useXterm.ts`: terminal creation, fit addon, resize observer, theme application.
- `components/shell/shellSnapshot.ts`: `renderShellSnapshot`, snapshot line splitting, prompt detection, command output extraction.
- `components/shell/ShellToolbar.tsx`
- `components/shell/ShellSplitLayout.tsx`
- `components/shell/types.ts`

Optimization impact:

- Terminal lifecycle becomes isolated from panel layout re-renders.
- Snapshot parsing becomes unit-testable.
- Socket cleanup logic becomes less dependent on the full component closure.

Risk:

- High. Socket cleanup and reconnect behavior can regress silently.

Required tests:

- `extractCommandOutput` for echo stripping, prompt stripping, blank lines, multi-line output.
- Snapshot cursor placement serialization.
- `shellControlSequence` coverage for each supported control action.
- Reconnect cleanup can be integration-tested with a fake adapter.

### P1.4 Split `ThreadWorkspaceLayout.tsx`

Current size: about 1,335 lines.

Observed responsibilities:

- Topbar, rooms rail, thread cards, desktop/mobile layout, theme controls, create/rename/delete thread dialogs, app navigation wiring.

Recommended split:

- `components/workspace-layout/ThreadWorkspaceLayout.tsx`
- `components/workspace-layout/ThreadCards.tsx`
- `components/workspace-layout/ThreadCard.tsx`
- `components/workspace-layout/ThreadTopbar.tsx`
- `components/workspace-layout/ThemeModeControl.tsx`
- `components/workspace-layout/NewThreadDialog.tsx`
- `components/workspace-layout/MobileNavigation.tsx`

Specific cleanup:

- Decide whether currently unused props `showMobileAppMenu`, `showMobileThreadNavToggle`, `appMenuButton`, and `appNavigationMenu` should be restored or removed from the public API.

### P1.5 Split global `styles.css`

Current size: about 4,628 lines.

Observed issue:

- All theme tokens, shell layout, timeline, composer, markdown, workspace, dialog, molecule/workspace styles live in one file. This makes visual changes risky and increases merge conflicts.

Recommended split:

- `styles/tokens.css`: theme tokens, light/dark variables.
- `styles/layout.css`: shell frame, topbar, side rails, responsive visibility.
- `styles/timeline.css`
- `styles/composer.css`
- `styles/markdown.css`
- `styles/workspace.css`
- `styles/dialogs.css`
- `styles/shell.css`
- `styles/plugin-overrides.css`
- Keep `src/styles.css` as the import aggregator so public exports stay stable.

Optimization impact:

- No runtime speedup by itself, but a large maintainability improvement.
- Makes it easier to remove duplicated dark/light selectors and eventually move repeated values into tokens.

## Priority 2: Package Boundary And Bundle Shape

### P2.1 Stop importing shared DTOs through source-relative paths

Files:

- `packages/plugin-runtime/src/artifacts.ts`
- `packages/plugin-runtime/src/types.ts`
- `packages/plugin-runtime/src/registry.ts`
- `packages/plugin-runtime/src/manifest.ts`
- `packages/plugin-runtime/src/artifacts.test.ts`

Current pattern:

```ts
import type { ThreadTurnDto } from '../../shared/src/index';
```

Recommended action:

- Add `@remote-codex/shared` as a workspace dependency/devDependency for `@remote-codex/plugin-runtime`.
- Import from `@remote-codex/shared`.

Why it matters:

- Source-relative imports bypass package exports and can break if packages are built/published independently.
- It couples `plugin-runtime` to repo layout rather than package contracts.

### P2.2 Revisit `thread-ui` dependency on built-in plugins and 3Dmol

Files:

- `packages/thread-ui/package.json`
- `packages/thread-ui/src/plugins/builtin-plugin-modules.tsx`
- `packages/thread-ui/src/plugins/xyz-plugin-renderers.tsx`

Current shape:

- Initially, `@remote-codex/thread-ui` depended directly on built-in plugin renderer paths and `builtinFrontendPlugins` imported molecule renderers eagerly.
- Current implementation moves built-ins behind `@remote-codex/thread-ui/builtin-plugins`, keeps `PluginProvider` defaulting to no built-ins, imports the XYZ manifest through `@remote-codex/plugin-xyz-viewer/manifest`, lazy-loads the XYZ frontend/CSS, and isolates 3Dmol in the playground `vendor-3dmol` chunk.
- `3dmol@2.5.5` includes the same callback-string `eval` helper in the CommonJS, ES, and minified distributed builds. The local choice is therefore to keep the supported package import and suppress only the known playground Rollup `EVAL` warning; replacing the dependency entry would not remove the underlying code.

Recommended action:

- Keep the current secondary-entrypoint pattern.
- Apply host-specific chunk and warning policy in applications that opt into built-in molecule rendering.
- Revisit the 3Dmol dependency only when an upstream release removes the `eval` helper or provides a documented CSP-safe build.

Why it matters:

- Chat-only consumers can now avoid eager built-in plugin and 3Dmol imports.
- 3Dmol is still a specialized heavy dependency, but it is now loaded only through the molecule rendering path or explicit built-in opt-in.

### P2.3 Align React dependencies in plugins

File:

- `packages/plugin-xyz-viewer/package.json`

Current issue:

- `react` and `react-dom` are listed in both `dependencies` and `peerDependencies`.

Recommended action:

- Keep `react` and `react-dom` as peer dependencies.
- Move them to dev dependencies for local build/test if needed.

Why it matters:

- Published React libraries should not install a second React copy.

## Priority 3: Runtime Performance And Rendering

### P3.1 Memoize timeline derivations

Files:

- `packages/thread-ui/src/components/ThreadTimeline.tsx`
- Future `timelineItems.ts`

Current issue:

- Timeline derivations create many arrays/maps/sets while rendering: visible IDs, notes by turn, pending requests by turn, queued steers, activity anchors, request anchors, live turn resolution.

Recommended action:

- Move derivations into named `useMemo` blocks with precise dependencies.
- Extract pure functions first, then memoize after tests exist.
- Avoid building `new Set(visibleTurns.map(...))` and request/note maps on every render unless relevant inputs changed.

Why it matters:

- Timeline is the highest-frequency surface during streaming.
- Reducing repeated derivation work improves responsiveness on long threads.

### P3.2 Avoid duplicate work in live fallback rendering

File:

- `packages/thread-ui/src/components/ThreadTimeline.tsx`

Current issue:

- `parseHookPromptText(liveOutput)` is called twice in the fallback live output block.

Recommended action:

- Compute `const liveHookPromptItem = useMemo(() => parseHookPromptText(liveOutput), [liveOutput])` or calculate once in the render branch.

Why it matters:

- Small improvement, but easy and removes repeated parsing during streaming.

### P3.3 Stabilize markdown code rendering

File:

- `packages/thread-ui/src/components/graph-chat/GraphChatMessageContent.tsx`

Current issue:

- The `CodeBlockRenderer` function is recreated per component render and closes over state. This is acceptable for small content, but markdown rendering is a hot path.
- Shiki HTML is injected with `dangerouslySetInnerHTML`. It is generated by a local highlighter, which is materially safer than untrusted HTML, but it should remain isolated and documented.

Recommended action:

- Extract code rendering into a small component with explicit props.
- Keep `dangerouslySetInnerHTML` inside a dedicated `ShikiCodeBlock` component.
- Add tests around language fallback, tool-call block rendering, and source text copy IDs.

### P3.4 Lazy-load heavy optional renderers

Files:

- `packages/thread-ui/src/plugins/xyz-plugin-renderers.tsx`
- `packages/plugin-xyz-viewer/src/XyzMoleculeViewer.tsx`

Recommended action:

- Use `React.lazy` or a small dynamic import wrapper for `@remote-codex/plugin-xyz-viewer/frontend`.
- Keep inline molecule detection cheap before triggering viewer load.

Why it matters:

- The molecule viewer is valuable but specialized. Loading it only when needed keeps the default chat path lighter.

## Priority 4: Security And Robustness

### P4.1 HTML parsing in composer paste

File:

- `packages/thread-ui/src/components/ThreadComposer.tsx`

Current behavior:

- `textFromClipboardHtml` assigns clipboard HTML to `container.innerHTML` and returns text content.

Assessment:

- Because only `textContent` is read and the container is not attached to the DOM, this is low risk.

Recommended action:

- Move this helper into a tested utility module.
- Add tests with styled HTML, scripts, entities, and nested blocks.
- Consider `DOMParser` for clearer intent.

### P4.2 TOML editing via string manipulation

File:

- `packages/thread-ui/src/components/ThreadComposer.tsx`

Current behavior:

- MCP server config updates are implemented by string block insertion/replacement.

Assessment:

- This may be acceptable for a narrow Codex TOML format, but it is brittle around comments, nested tables, and unusual whitespace.

Recommended action:

- If a TOML parser is available in the host/backend, prefer backend-side structured edits.
- If UI must edit strings, extract `upsertMcpServerBlock` and test common and malformed cases.

### P4.3 Artifact extraction input limits

File:

- `packages/plugin-runtime/src/artifacts.ts`

Current strengths:

- The extractor has candidate and node budgets.
- Existing tests include a large noisy tool output case.

Recommended action:

- Add tests for multiple artifact fences, duplicate fences, malformed JSON, and huge but fence-heavy markdown.
- Cache plugin artifact type lookup in a `Map` instead of scanning manifests for every artifact candidate.

### P4.4 3Dmol error handling

Files:

- `packages/plugin-xyz-viewer/src/XyzMoleculeViewer.tsx`
- `packages/thread-ui/src/components/graph-workspace/GraphMoleculeViewer.tsx`

Current issue:

- Renderer errors log to console and show generic UI state.

Recommended action:

- Keep console logging in development, but expose recoverable error details in UI state for failed model loads.
- Deduplicate viewer logic between the standalone plugin viewer and graph workspace viewer where feasible.

## Priority 5: Test Coverage Plan

Current test state:

- Only `packages/plugin-runtime/src/artifacts.test.ts` exists.
- No `thread-ui` component or utility tests are present.

Recommended near-term test modules:

- `packages/thread-ui/src/components/timeline/timelineItems.test.ts`
- `packages/thread-ui/src/components/timeline/liveOutput.test.ts`
- `packages/thread-ui/src/components/timeline/tokenFormatting.test.ts`
- `packages/thread-ui/src/components/composer/contentEditablePrompt.test.ts`
- `packages/thread-ui/src/components/composer/composerAttachments.test.ts`
- `packages/thread-ui/src/components/composer/mcpConfigBlocks.test.ts`
- `packages/thread-ui/src/components/composer/goalBudget.test.ts`
- `packages/thread-ui/src/components/shell/shellSnapshot.test.ts`
- `packages/thread-ui/src/components/graph-chat/graphChatToolBlocks.test.ts`
- `packages/plugin-runtime/src/manifest.test.ts`

Recommended integration tests:

- Playground smoke render in jsdom or Playwright: thread list, timeline render, composer input, open slash menu, switch shell unavailable view.
- Markdown render smoke: code block, tool-call block, molecule inline code fallback.
- Shell panel fake adapter: create shell, attach, detach, command output copy.

## File-Specific Findings

### `packages/thread-ui/src/components/ThreadComposer.tsx`

Problems:

- Too many responsibilities in one component.
- Large prop surface mixes backend management, chat input, shell controls, and draft control.
- State count is high and unrelated states share the same render cycle.
- DOM selection logic is embedded in the same component as slash panel business logic.
- MCP and hook editing logic cannot be tested without mounting the entire composer.

Optimizations:

- Extract pure utilities and tests first.
- Move contenteditable prompt into its own component/hook.
- Move backend management panels into separate components.
- Make shell composer a small alternate component instead of many `isShellView` class/branch checks in the main composer.

### `packages/thread-ui/src/components/ThreadTimeline.tsx`

Problems:

- Too many pure data transforms and UI components in one file.
- Current lint failures show dead code.
- Scroll state is complex and mixed with timeline data derivation.
- Similar deferred detail loading logic is duplicated for command/tool/generic items.

Optimizations:

- Extract `useTimelineScroll`.
- Extract and unit-test item grouping, sequence sorting, live merging, note anchoring.
- Replace duplicated deferred detail loaders with a single helper/hook.
- Memoize maps and anchors.

### `packages/thread-ui/src/components/ThreadShellPanel.tsx`

Problems:

- Terminal, WebSocket, split pane, and UI controls are tightly coupled.
- Hook dependency warning around `shellAdapter` suggests socket effects may capture stale adapter references.
- Snapshot parsing and output extraction are not tested.

Optimizations:

- Extract `ShellPane` and shell socket hook.
- Extract snapshot utilities and test them.
- Keep xterm lifecycle in a dedicated hook.

### `packages/thread-ui/src/styles.css`

Problems:

- Very large, multi-domain stylesheet.
- Dark/light selectors are repeated in many sections.
- Component ownership is hard to infer from CSS location.

Optimizations:

- Split by domain while preserving `src/styles.css` as aggregator.
- Consolidate theme selectors and component tokens.
- Consider CSS cascade layers: `tokens`, `base`, `layout`, `components`, `utilities`.

### `packages/plugin-runtime/src/artifacts.ts`

Problems:

- Imports shared types through source-relative path.
- Manifest artifact type lookup scans manifests repeatedly.
- Some nested block indentation is hard to read around artifact extraction loops.

Optimizations:

- Import from `@remote-codex/shared`.
- Build `artifactTypeToPluginId` once in constructor.
- Keep extraction functions pure and covered by tests.

### `packages/thread-ui/src/plugins/PluginProvider.tsx`

Problems:

- Built-in plugin module list is hardwired.
- Adapter object identity controls `refresh`; unstable adapter props from a host can cause unnecessary refreshes.

Optimizations:

- Allow injected built-ins.
- Document that host adapters should be stable, or destructure adapter callbacks into effect dependencies.
- Consider plugin renderer maps keyed by artifact type/language so rendering does not scan arrays each time.

### `packages/thread-ui/src/components/graph-chat/GraphChatMessageContent.tsx`

Problems:

- Markdown/tool/code rendering is dense.
- Code block renderer is recreated each render.
- Shiki HTML injection is intentionally local-generated but should be isolated.

Optimizations:

- Extract `MarkdownCodeRenderer`, `ShikiCodeBlock`, and tool block renderers.
- Add focused tests for preprocess/reconstruct/render decisions.

### `packages/plugin-xyz-viewer/src/XyzMoleculeViewer.tsx`

Problems:

- The file is under active local modification.
- It has viewer lifecycle, frame playback, selection, hover, camera, unit cell, screenshot, copy/download all in one component.

Optimizations:

- After current local changes settle, split into:
  - `use3DmolViewer`
  - `useMoleculeFrames`
  - `MoleculeViewerToolbar`
  - `MoleculeViewerStatusOverlay`
  - `moleculeExport.ts`
- Keep package React dependencies as peers plus dev dependencies, not runtime dependencies.

## Suggested Execution Order

1. Fix lint failures and warnings that are not design decisions.
2. Add tests for pure utility behavior that already exists.
3. Extract `ThreadTimeline` pure functions and scroll hook.
4. Extract `ThreadComposer` pure functions, then prompt editor, then slash panels.
5. Extract `ThreadShellPanel` shell snapshot utilities, then `ShellPane`, then socket hook. Shell snapshot utilities and `ShellPane` are complete; the remaining split is the socket hook/controller.
6. Fix `plugin-runtime` package boundary imports.
7. Split CSS into imported domain files.
8. Rework plugin bundle boundaries and lazy-load molecule viewer.
9. Add playground/browser smoke tests.

## Definition Of Done For The Optimization Pass

- `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- `thread-ui` has tests for timeline item derivation, composer attachments/draft sync utilities, and shell snapshot parsing.
- No source-relative imports cross package boundaries.
- `ThreadComposer.tsx`, `ThreadTimeline.tsx`, and `ThreadShellPanel.tsx` are each reduced toward orchestration components with most pure logic and subviews extracted. `ThreadShellPanel.tsx` now delegates single-pane terminal lifecycle to `ShellPane.tsx`; the remaining high-risk shell work is testing/extracting the socket lifecycle inside that pane.
- `styles.css` remains as the public import but delegates to smaller domain files.
- Chat-only consumers can use `thread-ui` without eagerly importing 3Dmol renderer code.
