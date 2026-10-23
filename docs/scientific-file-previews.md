# Scientific file previews (ORCA, PySCF)

Status: format routing implemented (ELA-219, B28); cube and ESD spectrum
renderers designed, not implemented.

Source of the format list: the ORCA/PySCF format table Juan Bernardo Perez
shared on 2026-10-22 (ElAgente dev2 triage). It is the requirements input. It
does not show which of these files failed on dev2.

## Current routing (`explorer/filePreviewPolicy.ts`)

| Files | Explorer behaviour |
| --- | --- |
| `.gbw`, `.densities`, `.mp2nat`, `.uno`, `.qro`, `.uco` (ORCA), `.chk` (PySCF HDF5), `.bson`, `.ubjson`, `.msgpack` | Download only. Not read as text. The pane says why (`files.safeReason.scientificBinaryFile`). |
| `.carthess`, `.opt`, `.plt`, files with no extension (PySCF temporary checkpoints) | Encoding not confirmed, so the extension does not decide. The first chunk is checked for NUL bytes, control characters and the HDF5 signature. Binary data gets the generic "not text" download state. |
| `.md`, `.markdown` | Markdown preview, with a source view. |
| `.py` and other source files | Code view. App-servers report the bare extension as `language` (`py`, `sh`, `md`). `codeLanguage()` maps it to the Monaco/Shiki id (`python`, `shell`, `markdown`). Unknown ids fall back to plain text. |
| `.inp`, `.out`, `.log`, `.hess`, `.mkl`, `.molden(.input)`, `.property.txt/.json`, `FCIDUMP`, `.cube/.cub`, `.spectrum(.rootN)` | Plain-text preview in chunks, with "load more". |
| `.xyz`, `*_trj.xyz` and the other molecular formats | Molecule viewer (unchanged). |

## Proposed: cube renderer

`.cube/.cub` files are text volumetric grids (orbitals, densities,
potentials). 3Dmol 2.x can parse them: `addModel(data, 'cube')` reads the atoms,
and `addVolumetricData(data, 'cube', { isoval, color, opacity })` draws an
isosurface.

- Register `cube`/`cub` as a molecular format so the file opens in
  `GraphMoleculeViewer`, not as text. The shared `StructureAsset.format`
  union and the `plugin-xyz` `fileExtensions` list must be extended in the
  same release.
- Draw two isosurfaces, at +isovalue and -isovalue, in two colours. Start at
  0.02 for orbitals. Add an isovalue slider and an opacity control to the
  existing lower button group.
- Grids are often 5–100 MB. Keep the 10 MiB `MAX_MOLECULAR_PREVIEW_BYTES` cap
  and show the download state above it. Parse the header before drawing and
  reject grids above about 200³ points.
- Tests: header parsing (negative atom count means MO cube), the size cap,
  and that the surfaces are cleared when the frame changes.

## Proposed: ESD spectrum renderer

ORCA ESD writes `.spectrum` (all states) and `.spectrum.rootN` (one state) as
whitespace tables. The header names the columns (energy, total and component
intensities).

- The host already has a bounded spectrum plot for reviewed
  `frequency,intensity` CSV artifacts (cloud infra
  `apps/web/components/agent-workspace/SpectrumViewer.tsx`). Reuse it: add a
  parser from the ESD table to the same `SpectrumSample[]` and register a file
  renderer for `spectrum` and `root\d+` suffixes.
- Choose the x unit and intensity column from the header. Keep the existing
  sample cap (2048) by binning, not truncating.
- This needs real ESD sample files from the Quntur owners before anything is
  built. Column layouts differ between ORCA versions and spectrum types.
