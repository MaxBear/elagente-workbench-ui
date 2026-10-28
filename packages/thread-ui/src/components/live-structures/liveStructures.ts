/**
 * Generic live-structure data for {@link LiveStructuresPanel}. Hosts translate
 * their transport (for example a latest-only telemetry stream) into these
 * shapes; the panel never talks to a server.
 */
export type LiveStructureStatus = 'running' | 'done' | 'failed';
export type LiveStructureSummaryValue = string | number | boolean | null;
export type LiveStructureSummary = Record<string, LiveStructureSummaryValue>;

/** A stream is identified by its producer and its ID within that producer. */
export interface LiveStructureKey {
  producer: string;
  id: string;
}
export interface LiveStructureRow extends LiveStructureKey {
  status: LiveStructureStatus;
  seq?: number;
  summary?: LiveStructureSummary | null;
  updatedAt?: string | null;
}
/** The latest single frame of a watched stream (XYZ or extXYZ text). */
export interface LiveStructureFrame extends LiveStructureKey {
  seq?: number;
  format: string;
  xyz: string;
}
/** One frame of a watched stream's trajectory, in `seq` order. */
export interface LiveTrajectoryFrame {
  seq: number;
  format: string;
  xyz: string;
}
export interface LiveStructureTotals {
  streams: number;
  running: number;
  done: number;
  failed: number;
}
export interface LiveStructureProducer {
  id: string;
  streams: number;
  updatedAt?: string | null;
}
export type LiveStructureStatusFilter = LiveStructureStatus | null;
export interface LiveStructureColumn {
  /** `id` and `status` are the row's own fields; other keys read the summary. */
  key: string;
  label: string;
  numeric?: boolean;
}

export const LIVE_STRUCTURES_MAX_SELECTED = 4;
export const LIVE_STRUCTURES_PAGE_SIZE = 100;

/** A stable string identity for a stream. */
export function liveStructureKey(key: LiveStructureKey): string {
  return JSON.stringify([key.producer, key.id]);
}
export function sameLiveStructure(a: LiveStructureKey, b: LiveStructureKey) {
  return a.producer === b.producer && a.id === b.id;
}

const PREFERRED = ['label', 'stage', 'step', 'energy'] as const;
const BUILTIN_LABELS: Record<string, string> = {
  id: 'ID',
  label: 'Label',
  stage: 'Stage',
  step: 'Step',
  energy: 'Energy',
  status: 'Status',
};

/**
 * Columns for the loaded rows: ID, then label, stage, step and energy when
 * any row reports them, then other summary keys in alphabetical order, then
 * status. `unit` is shown with the energy rather than as its own column.
 */
export function deriveLiveStructureColumns(
  rows: readonly LiveStructureRow[],
  labels: Partial<Record<string, string>> = {},
): LiveStructureColumn[] {
  const keys = new Set<string>();
  const numeric = new Map<string, boolean>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.summary ?? {})) {
      keys.add(key);
      if (value !== null) numeric.set(key, (numeric.get(key) ?? true) && typeof value === 'number');
    }
  }
  const hasUnit = keys.has('unit') && keys.has('energy');
  const extra = [...keys]
    .filter(key => !(PREFERRED as readonly string[]).includes(key) && key !== 'id' && key !== 'status' && !(hasUnit && key === 'unit'))
    .sort((a, b) => a.localeCompare(b));
  const label = (key: string) => labels[key] ?? BUILTIN_LABELS[key] ?? key;
  return [
    { key: 'id', label: label('id') },
    ...PREFERRED.filter(key => keys.has(key)).map(key => ({ key, label: label(key), numeric: numeric.get(key) ?? false })),
    ...extra.map(key => ({ key, label: label(key), numeric: numeric.get(key) ?? false })),
    { key: 'status', label: label('status') },
  ];
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 10 });
export function formatLiveStructureValue(value: LiveStructureSummaryValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? numberFormat.format(value) : '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return value;
}
/** The text of one cell; energy carries its unit when the row has one. */
export function liveStructureCell(row: LiveStructureRow, key: string): string {
  if (key === 'id') return row.id;
  if (key === 'status') return row.status;
  const summary = row.summary ?? {};
  const text = formatLiveStructureValue(summary[key]);
  if (key === 'energy' && text && typeof summary.unit === 'string' && summary.unit) return `${text} ${summary.unit}`;
  return text;
}

/**
 * Toggles one stream in a selection of at most `max` streams. Selecting past
 * the limit returns the selection unchanged.
 */
export function toggleLiveStructure(
  selected: readonly LiveStructureKey[],
  key: LiveStructureKey,
  max = LIVE_STRUCTURES_MAX_SELECTED,
): LiveStructureKey[] {
  if (selected.some(value => sameLiveStructure(value, key))) return selected.filter(value => !sameLiveStructure(value, key));
  if (selected.length >= max) return [...selected];
  return [...selected, { producer: key.producer, id: key.id }];
}

export function liveStructurePageCount(total: number, pageSize = LIVE_STRUCTURES_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}
export function totalForFilter(totals: LiveStructureTotals, filter: LiveStructureStatusFilter) {
  return filter ? totals[filter] : totals.streams;
}

/**
 * The durable trajectory file a stream's summary names (`summary.trajectory`),
 * when it is a plain workspace-relative path; null otherwise.
 */
export function liveStructureTrajectoryPath(row: Pick<LiveStructureRow, 'summary'> | null | undefined): string | null {
  const path = row?.summary?.trajectory;
  if (typeof path !== 'string' || !path || path.length > 1024) return null;
  if (/^[\\/]|^[a-z][a-z0-9+.-]*:/i.test(path) || path.includes('\\')) return null;
  if (path.split('/').some(part => part === '..')) return null;
  return path;
}
