# Finite workbench panels

`MatterWorkbenchOptions.panels` is optional. Hosts can keep the original Matter
layout or supply a primary identity, protected reference renderer, collaboration
renderer, same-device candidates and explicit `onMakePrimary` action. The shared
UI does not fetch data, open sockets, send prompts or stop threads.

The panel renderer has one primary view plus files, a read-only conversation or
collaboration in the reference area. It changes to a single visible view below
800px of available content width. Hidden views use `hidden`, and visited file
content stays mounted. Existing workspace adapters and file editor stores are
unchanged.

`useWorkbenchPresentation(scope)` stores one reference ID separately from mode
and ratio. A host must supply an origin/account/device/workspace-scoped key, or
null for memory-only state. Corrupt arrangement cannot discard the member.
Storage failures are exposed through `storageFailed`. Drafts and execution state
are deliberately outside this store. A host controls permission checks and the
single composer target.

Validation: `presentation.test.ts` covers corrupt/future arrangement, invalid
members and ratio normalization. The main repository's workbench-panels browser
spec covers real reference rendering, drafts, native result opening, restoration,
mobile Back, independent scrolling, late responses and running primary continuity.
