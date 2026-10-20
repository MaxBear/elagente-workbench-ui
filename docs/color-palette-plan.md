# Workbench Color Palette Plan

## Goal and scope

Replace the Classic workbench's green-tinted chrome and controls with a palette grounded in the supplied ElAgente references. Use the light interface conventions from `the-matter-lab/elagente-client-frontend`, and combine the dark layer structure from `the-matter-lab/matter-designs` with the rendered dark colors and pink brand accent from `elagente.ca`.

This is a palette-only change. Keep the current layout, interaction behavior, content, and scientific visualizations intact. Reference repositories are private and have no license; use sampled color values only, and copy no assets, fonts, logos, or source code.

## Evidence

Values marked **computed/source** were read from repository tokens or rendered CSS. Approximate composites are marked **derived**.

### Dark references

`elagente.ca`, rendered in Chromium on 2026-10-20; stylesheet `https://elagente.ca/assets/index-BmBb2xOw.css`:

| Role | Value | Evidence |
| --- | --- | --- |
| Background | `#0A0F1F` | **Computed** body/background; source `--background: 225 50% 8%` |
| Foreground | `#F0F1F5` | **Computed** body text; source `--foreground: 220 20% 95%` |
| Muted foreground | `#7B879D` | **Computed** muted text; source `--muted-foreground: 220 15% 55%` |
| Card / secondary / muted | `#11182C` / `#171F36` / `#20273C` | **Computed from source HSL** `225 45% 12%`, `225 40% 15%`, `225 30% 18%` |
| Border | `#242B42` | **Computed from source HSL** `225 30% 20%`; other visible borders use white at 10-15% alpha |
| Primary | `#1D2E63` | **Computed from source HSL** `225 55% 25%` |
| Accent / focus ring | `#E64C7F` | **Computed from source HSL** `340 75% 60%`; rendered gradient sample `rgb(230,77,128)` |
| Brand colors | `#F49D25`, `#8039C6`, `#193076` | **Computed from source HSL** orange, purple, and navy tokens |

The site remains dark under a light system preference. The interactive chrome is visually neutral; pink is used for brand emphasis and glow. Neutral control rendering is a visual observation, not an explicit component-token mapping.

`the-matter-lab/matter-designs` at `54987ee4ff9268ce0c681f1b59be6b8ee13f065f`, `gallery/design-system/index.html` lines 43-59:

| Role | Value |
| --- | --- |
| Layer sequence | `#080A0C` background, `#0E1215` chat canvas, `#13171B` workspace, `#171C21` chrome, `#1A2026` / `#1F262C` / `#252E35` raised surfaces |
| Borders | `#222A30`, strong `#35404A` |
| Text | `#F4F7F6`, soft `#A7B0B7`, muted `#7B868E` |
| Hover / selected wash | `rgba(196,214,226, .03)` / `.055` |
| Status | run `#8FC2E8`, warning `#E8B764`, error `#E8908A` |
| Existing green accent | `#00A764` / `#00CC76`; **intentionally not adopted** |

The repository's molecule-viewer `index.html` lines 56 and 82 define a neutral focus wash (`rgba(130,138,146,.22)` light and `rgba(167,176,183,.22)` dark). Its design-system rule says to use accents for actions and selection, and status colors for state only.

### Light reference

`the-matter-lab/elagente-client-frontend` at `a7400ea448ce3f0b04713c0895e0ffe93ab2b999` (`main`), source `src/index.css` and component usage counts. The app itself requires a login/backend, so these are source values, not browser-computed app output.

| Role | Value | Evidence |
| --- | --- | --- |
| Background / text | `#FFFFFF` / `#0A0A0A` | Source token / 167 source uses |
| Border / muted text | `#E5E5E5` / `#737373` | Source token / 135 and 97 source uses |
| Primary and Send buttons | `#171717` with white text; hover `#1F2937` | `chat-composer.tsx:180`, `account.tsx:205`, `chat-screen-id.tsx:1211` |
| Navy indicator | `#28377A`, hover `#212E66` | New chat `sidebar.tsx:678`, active navigation `:1015`, context-menu focus `reusable-context-menu.tsx:126` |
| User bubble | `#F3F4F6` | Repeated component class |
| Info callout | `#F4F8FF`, `#BFD7FF`, `#285EA8`, `#1E3A5F` | `chat-screen-id.tsx:1300` |
| Error | `#DC2626` | Source class `red-600` |

The purple `--primary` token is mostly used by spinners, a switch, and link variants. Common action buttons render near-black, so the workbench will use that neutral action treatment rather than making all controls purple.

## Current workbench inventory

The main green palette is in `packages/thread-ui/src/styles/matter-workbench.css` (`.thread-ui-shell.thread-ui-shell` and its dark selector): hue-145 neutrals, `#00A764` / `#00CC76` primary, and green accent-soft/strong/border. These tokens currently feed Send, active thread and rail states, unread marker, composer focus, timeline/pulse, selected settings/explorer rows, viewer controls, and resize handles.

Additional Classic green sources to review and remap by role:

- `styles/export-dialog.css`: `--export-*` action tokens.
- `styles/composer-plan.css`, `styles/history-markdown.css`: completed and tool-status labels, execution steps, selected/active markers.
- `GraphChatMessageBody.tsx` and `useComposerPromptDomSync.ts`: attachment chips.
- `GraphChatHistoryItems.tsx`: tool-call and file-change groups; `history-markdown.css`: history icons and sender chip.
- `timeline-shell.css`: incoming-token badge.
- `WorkspaceExplorerRow.tsx`, `WorkspaceExplorerPanel.tsx`, `WorkspaceFileTabs.tsx`: code-file icons.
- `styles/molecule-figure.css` and `apps/playground/src/molecule-viewer-demo.css`: green fallbacks/demo overrides.

The detailed initial inventory, screenshots, computed samples, and baseline contrast measurements are in the ignored local evidence directory `output/workbench-ui-colors/`.

## Proposed Classic tokens

Keep the existing `--theme-*` role mapping and replace the `--thread-gc-*` values in both `matter-workbench.css` and the `base.css` fallback. The action fill is deliberately neutral; mode-specific navy/pink is reserved for selection and focus.

| Token role | Light | Dark |
| --- | --- | --- |
| Background / chat canvas | `#FFFFFF` | `#0A0F1F` |
| Panel | `#FFFFFF` | `#11182C` |
| Chrome | `#F5F5F5` | `#11182C` |
| Surface / sidebar | `#FAFAFA` | `#171F36` |
| Raised / hover surface | `#F3F4F6` | `#20273C` |
| Border / strong border | `#E5E5E5` / `#D4D4D4` | `#242B42` / white at 15% alpha |
| High-contrast border | `#737373` | `#7B879D` |
| Foreground / soft / muted | `#0A0A0A` / `#525252` / derived `#6E6E6E` | `#F0F1F5` / `#C2C4CA` / `#7B879D` |
| Primary action / action text | `#171717` / `#FFFFFF` | `#F0F1F5` / `#0A0F1F` |
| Primary action hover | `#1F2937` | `#FFFFFF` |
| Accent strong / focus ring | `#28377A` | derived `#EC5B87` / reference `#E64C7F` |
| Accent soft | derived navy wash `#EEEFF4` | derived pink wash `#29182C` |
| Info / running | `#285EA8` | `#8FC2E8` |
| Warning | `#8A5A00` | `#E8B764` |
| Error | `#DC2626` | `#E8908A` |
| Completed | neutral `fg-soft` and existing check icon | neutral `fg-soft` and existing check icon |

The dark primary action uses inverse-neutral `#F0F1F5` with dark text. This mirrors the light near-black action, follows the rendered neutral control treatment of `elagente.ca`, and keeps pink available for focus/selection without placing it beside the red Stop control. The focus ring uses the exact site pink `#E64C7F`; the slightly lighter active-text pink `#EC5B87` is derived from that value to meet the 4.5:1 text contrast target on the dark workspace surface. Keep the blue/pink accent distinct from scientific status and result colors.

Contrast targets: body and muted text at least 4.5:1 on their surfaces; action label and strong text accent at least 4.5:1; focus and non-text boundaries at least 3:1. The source muted gray `#737373` is darkened slightly to `#6E6E6E` so it also clears 4.5:1 against the `#F5F5F5` chrome. On dark raised surfaces, use soft foreground instead of muted foreground where contrast would fall below 4.5:1.

## Implementation sequence

1. Update the Classic light/dark token blocks in `matter-workbench.css` and matching `base.css` fallbacks, including neutral role layers, action tokens, focus token, and state tokens.
2. Add `--theme-focus-ring`, route Classic focus indicators through it (including the currently undefined image zoom focus variable), and give Terminal its own focus-ring/status tokens so it remains independent.
3. Map export dialog actions to shared action tokens. Remap generic completed/running/warning/error indicators, unread and timeline markers, attachment chips, tool/file-change groups, history badges, and code-file icons to neutral, navy/info, amber, or error roles. Remove green from common controls without altering science visualization semantics.
4. Replace green demo/fallback values in the molecule viewer UI with role tokens. Leave the viewer's scientific molecule/element palette unchanged.
5. Add focused checks for token presence, Classic no-green UI accents, Terminal opt-in palette isolation, and WCAG contrast targets.
6. Run thread-ui tests, typecheck, build, and layout fixture checks. Capture after screenshots for Classic and Terminal, both modes and desktop/mobile, and compare with `output/workbench-ui-colors/before/`.

## Non-goals

- Do not recolor molecular/CPK elements, scientific plots/graphs, validity and result semantics, code syntax, Monaco/Shiki, xterm ANSI colors, or add/remove diff semantics.
- Do not change behavior, layout, Agent execution, API contracts, protocol, or deployment pins.
- Keep Terminal as an explicit opt-in Appearance preset. Preserve its upstream identity: ink blue `#0A47C4` in light and phosphor green `#4DE3A2` in dark. Keep those values isolated from Classic focus and action tokens.
- Exclude anime/Plum Pocket and Pockymoe account/device branding.

