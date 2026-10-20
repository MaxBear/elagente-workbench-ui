# Scientific Workbench UI Polish

This branch starts from the UI revision pinned by cloud infrastructure
`elagente-ui-v0.1.7` (`3a01a82d`). It adapts selected shared UI work from the
public Pockymoe UI source while keeping the browser surface independent of
Pockymoe account, device, coding-agent, and harness behavior.

## Included

- Keep the conversation surface mounted while same-thread detail refreshes;
  preserve scientific viewers and camera/trajectory state. During a switch to
  another thread, clear transcript, workspace, pending actions, and draft state
  until the new detail arrives.
- Preserve native editor changes during dictation and IME composition, including
  delayed host echoes and asynchronous attachment preview updates.
- Add generic local workbench preferences: Terminal theme, reading size,
  completed-work collapse, reduced motion, compact prompt, and one-handed phone
  navigation with left/right placement.
- Retain full loaded history when deferred detail merges, show loader failures
  with retry separately from tool output, support horizontally scrollable
  Markdown tables, and improve dialog focus handling.
- Load PDF/image content only through the existing host workspace adapter. The
  optional `readRawFile` adapter method lets hosts provide authenticated Blob
  reads; existing versioned file URLs remain supported. Scientific artifact
  identity, revisions, checksums, permissions, and viewer state are unchanged.
- Apply stable Markdown renderers and safe PDF viewer fallbacks without
  changing scientific inline renderers or arbitrary host-path resolution.

## Upstream References

The reviewed public source is `dufangshi/pockymoe-thread-ui-rust` at
`b35e997b`. Selected revisions adapted on this branch are `8f7e5d2`,
`e5dc4a3`, `14d4a68`, `e529c1c`, `dcfd2ea`, `50f4c1b`, `2f1d1a4`,
`f784497`, `0303980`, and `eab9e5d`. These are reference revisions, not
cherry-picks: each behavior was adjusted to the existing shared DTO and host
adapter contracts.

The Terminal theme is derived from `themes/terminal` in that same public
checkout. Its theme metadata declares MIT; the required notice is retained in
[`TERMINAL_THEME_LICENSE.md`](TERMINAL_THEME_LICENSE.md). Only theme tokens and
generic shell/transcript/composer styling were adapted. Agent avatar packs and
account-specific theme behavior were omitted.

## Explicitly Excluded

Anime/Plum Pocket theme and assets; coding-account and device settings; harness
controls; provider-specific actions; arbitrary filesystem paths; and changes to
cloud infrastructure, app-server protocol, runtime behavior, or deployment
pins. The supported scientific product scope remains Grafico (including
Optima/Potente workflows), Quntur, and Estructural.

## Validation Boundary

The Playground provides local UI fixtures only. Its interactions do not invoke
scientific jobs or real Agent backends. Production hosts must wire
`readRawFile` to their existing authorization and versioned workspace-file
endpoints to use Blob-based PDF preview.
