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

export function isDownloadOnlyPath(path: string) {
  return DOWNLOAD_EXTENSIONS.has(extensionOf(path));
}

export function isBinaryPreview(content: string) {
  if (content.includes('\0')) return true;
  // Catch unknown binary formats decoded lossily by the text preview endpoint.
  const sample = content.slice(0, 8000);
  const suspicious = sample.match(/[\x01-\x08\x0e-\x1f\ufffd]/g)?.length ?? 0;
  return suspicious >= 3 && suspicious / sample.length > 0.02;
}
