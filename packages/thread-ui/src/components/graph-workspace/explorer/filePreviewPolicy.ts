import { extensionOf } from '../workspaceTree';

export const DRAWIO_MAX_BYTES = 8 * 1024 * 1024;
export function isDrawioPath(path: string) { return ['drawio', 'dio'].includes(extensionOf(path)); }

// Formats for which this Explorer has no renderer. Do not fetch them as text.
const DOWNLOAD_EXTENSIONS = new Set([
  'zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'br',
  'exe', 'dll', 'so', 'dylib', 'dmg', 'iso', 'pkg', 'deb', 'rpm', 'msi',
  'bin', 'wasm', 'class', 'jar', 'pyc', 'o', 'a',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'db', 'sqlite', 'sqlite3', 'parquet', 'arrow', 'npy', 'npz', 'h5', 'hdf5',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mov', 'mkv', 'webm', 'avi',
  'psd', 'ai', 'sketch', 'heic', 'tif', 'tiff', 'woff', 'woff2', 'ttf', 'otf',
]);

// ORCA and PySCF binary outputs (orbitals, densities, checkpoints, binary JSON
// exports). `.carthess`/`.opt` and ORCA `.plt` may be text or binary, and
// PySCF checkpoints may have no extension: those are decided by content.
const SCIENTIFIC_BINARY_EXTENSIONS = new Set([
  'gbw', 'densities', 'mp2nat', 'uno', 'qro', 'uco', 'chk',
  'bson', 'ubjson', 'msgpack',
]);

export function isDownloadOnlyPath(path: string) {
  const extension = extensionOf(path);
  return DOWNLOAD_EXTENSIONS.has(extension) || SCIENTIFIC_BINARY_EXTENSIONS.has(extension);
}

/** Why a download-only path is not shown, as a `files.safeReason.*` key. */
export function downloadOnlyReason(path: string) {
  return SCIENTIFIC_BINARY_EXTENSIONS.has(extensionOf(path)) ? 'scientificBinaryFile' : null;
}

// Editor language ids for the extensions an app-server reports as `language`.
const CODE_LANGUAGES: Record<string, string> = {
  py: 'python', pyi: 'python', ipy: 'python',
  md: 'markdown', markdown: 'markdown',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  rs: 'rust',
  h: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  jsonl: 'json',
  text: 'plaintext', txt: 'plaintext',
};

/** Normalises a path extension or reported language to an editor language id. */
export function codeLanguage(language: string) {
  const key = language.toLowerCase();
  return CODE_LANGUAGES[key] ?? (key || 'plaintext');
}

// HDF5 (PySCF checkpoints, with or without `.chk`) decoded as UTF-8 text.
const HDF5_SIGNATURE = /^\ufffdHDF\r\n\u001a\n/;

export function isBinaryPreview(content: string) {
  if (content.includes('\0') || HDF5_SIGNATURE.test(content)) return true;
  // Catch unknown binary formats decoded lossily by the text preview endpoint.
  const sample = content.slice(0, 8000);
  const suspicious = sample.match(/[\x01-\x08\x0e-\x1f\ufffd]/g)?.length ?? 0;
  return suspicious >= 3 && suspicious / sample.length > 0.02;
}
