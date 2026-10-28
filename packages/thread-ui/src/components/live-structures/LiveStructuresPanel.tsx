import { ChevronDown, ChevronLeft, ChevronRight, PanelRightOpen, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { formatNumber, useI18n, type TranslationKey } from '../../i18n';
import { LiveStructureFrameViewer } from './LiveStructureFrameViewer';
import {
  deriveLiveStructureColumns,
  LIVE_STRUCTURES_MAX_SELECTED,
  LIVE_STRUCTURES_PAGE_SIZE,
  liveStructureCell,
  liveStructureKey,
  liveStructurePageCount,
  sameLiveStructure,
  toggleLiveStructure,
  totalForFilter,
  type LiveStructureColumn,
  type LiveStructureFrame,
  type LiveStructureKey,
  type LiveStructureProducer,
  type LiveStructureRow,
  type LiveStructureStatus,
  type LiveStructureStatusFilter,
  type LiveStructureTotals,
} from './liveStructures';

export interface LiveStructuresPanelProps {
  totals: LiveStructureTotals;
  producers?: readonly LiveStructureProducer[];
  /**
   * The rows to show. With `onPageChange` these are the rows of `page`
   * (the host pages); without it the panel pages through them itself.
   */
  rows: readonly LiveStructureRow[];
  /** Zero-based page; host-controlled together with `onPageChange`. */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Rows available across all pages (host paging); defaults to the matching total. */
  rowCount?: number;
  pageSize?: number;
  /** Host-controlled status filter; the totals become filter toggles. */
  statusFilter?: LiveStructureStatusFilter;
  onStatusFilterChange?: (filter: LiveStructureStatusFilter) => void;
  selected: readonly LiveStructureKey[];
  onSelectionChange: (selected: LiveStructureKey[]) => void;
  maxSelected?: number;
  /** Latest frames of watched streams; others are ignored. */
  frames?: readonly LiveStructureFrame[];
  /** Latest known rows of selected streams that may not be on the shown page. */
  selectedRows?: readonly LiveStructureRow[];
  /** The producing turn has ended: the panel shows the last reported state. */
  ended?: boolean;
  loading?: boolean;
  error?: string | null;
  title?: ReactNode;
  defaultOpen?: boolean;
  columns?: readonly LiveStructureColumn[];
  /** Replaces the default inline molecule viewer for one frame. */
  renderViewer?: (frame: LiveStructureFrame) => ReactNode;
  /**
   * Opens a stream's trajectory player in the host's side panel. When given,
   * watched viewers and table rows offer "Open trajectory".
   */
  onOpenTrajectory?: (stream: LiveStructureKey) => void;
  className?: string;
}

const STATUS_LABEL: Record<LiveStructureStatus, TranslationKey> = {
  running: 'chat.liveStructuresStatusRunning',
  done: 'chat.liveStructuresStatusDone',
  failed: 'chat.liveStructuresStatusFailed',
};
const STATUS_TAG: Record<LiveStructureStatus, string> = {
  running: 'is-accent',
  done: 'is-success',
  failed: 'is-danger',
};
const COLUMN_LABEL: Record<string, TranslationKey> = {
  id: 'chat.liveStructuresColumnId',
  label: 'chat.liveStructuresColumnLabel',
  stage: 'chat.liveStructuresColumnStage',
  step: 'chat.liveStructuresColumnStep',
  energy: 'chat.liveStructuresColumnEnergy',
  status: 'chat.liveStructuresColumnStatus',
};
const VISIBLE_PRODUCERS = 3;

/**
 * Summaries and latest frames of many concurrently relaxing or simulated
 * structures. Totals and producers head a paged summary table; selected rows
 * (at most four by default) open inline viewers of their latest frame. The
 * panel is data-only: the host supplies rows, frames and paging, and turns
 * selection changes into whatever watch request its transport needs.
 */
export function LiveStructuresPanel({
  totals,
  producers = [],
  rows,
  page: controlledPage,
  onPageChange,
  rowCount,
  pageSize = LIVE_STRUCTURES_PAGE_SIZE,
  statusFilter = null,
  onStatusFilterChange,
  selected,
  onSelectionChange,
  maxSelected = LIVE_STRUCTURES_MAX_SELECTED,
  frames = [],
  selectedRows = [],
  ended = false,
  loading = false,
  error = null,
  title,
  defaultOpen = true,
  columns: columnsOverride,
  renderViewer,
  onOpenTrajectory,
  className = '',
}: LiveStructuresPanelProps) {
  const { t, locale } = useI18n();
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [localPage, setLocalPage] = useState(0);
  const hostPaged = Boolean(onPageChange);
  const total = hostPaged ? (rowCount ?? totalForFilter(totals, statusFilter)) : rows.length;
  const pageCount = liveStructurePageCount(total, pageSize);
  const page = Math.min(Math.max(0, hostPaged ? (controlledPage ?? 0) : localPage), pageCount - 1);
  const shownRows = useMemo(
    () => (hostPaged ? rows : rows.slice(page * pageSize, page * pageSize + pageSize)),
    [hostPaged, rows, page, pageSize],
  );
  const columns = useMemo(() => {
    if (columnsOverride) return [...columnsOverride];
    const labels = Object.fromEntries(Object.entries(COLUMN_LABEL).map(([key, value]) => [key, t(value)]));
    return deriveLiveStructureColumns(shownRows, labels);
    // `t` reads the current locale; the locale is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsOverride, shownRows, locale]);
  const changePage = (next: number) => {
    const bounded = Math.min(Math.max(0, next), pageCount - 1);
    if (hostPaged) onPageChange?.(bounded);
    else setLocalPage(bounded);
  };
  const isSelected = (row: LiveStructureKey) => selected.some(value => sameLiveStructure(value, row));
  const full = selected.length >= maxSelected;
  const toggle = (row: LiveStructureKey) => {
    const next = toggleLiveStructure(selected, row, maxSelected);
    if (next.length !== selected.length) onSelectionChange(next);
  };
  const frameByKey = useMemo(() => new Map(frames.map(frame => [liveStructureKey(frame), frame])), [frames]);
  const rowByKey = useMemo(() => {
    const map = new Map<string, LiveStructureRow>();
    for (const row of selectedRows) map.set(liveStructureKey(row), row);
    for (const row of rows) map.set(liveStructureKey(row), row);
    return map;
  }, [rows, selectedRows]);
  const number = (value: number) => formatNumber(value);
  const openButton = (key: LiveStructureKey) => onOpenTrajectory ? (
    <button type="button" className="live-structures-icon-button live-structures-open-trajectory"
      aria-label={t('chat.liveStructuresOpenTrajectoryOf', { id: key.id })} title={t('chat.liveStructuresOpenTrajectory')}
      onClick={() => onOpenTrajectory({ producer: key.producer, id: key.id })}><PanelRightOpen size={14} aria-hidden="true" /></button>
  ) : null;
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, page * pageSize + shownRows.length);

  const totalsNode = (
    <ul className="live-structures-totals" aria-label={t('chat.liveStructures')}>
      {([null, 'running', 'done', 'failed'] as const).map(filter => {
        const value = filter ? totals[filter] : totals.streams;
        const text = filter === null
          ? t('chat.liveStructuresStreams', { count: value, value: number(value) })
          : t(filter === 'running' ? 'chat.liveStructuresRunningCount' : filter === 'done' ? 'chat.liveStructuresDoneCount' : 'chat.liveStructuresFailedCount', { value: number(value) });
        const tone = filter === 'failed' && value > 0 ? ' is-danger' : filter === 'done' && value > 0 ? ' is-success' : '';
        return (
          <li key={filter ?? 'all'}>
            {onStatusFilterChange ? (
              <button
                type="button"
                className={`live-structures-total plugin-report-tag${tone}`}
                aria-pressed={statusFilter === filter}
                title={t('chat.liveStructuresFilter')}
                onClick={() => onStatusFilterChange(filter)}
              >{text}</button>
            ) : <span className={`live-structures-total plugin-report-tag${tone}`}>{text}</span>}
          </li>
        );
      })}
    </ul>
  );
  const producersNode = producers.length > 0 ? (
    <p className="live-structures-producers plugin-report-meta">
      <span>{t('chat.liveStructuresProducers')}:</span>{' '}
      {producers.slice(0, VISIBLE_PRODUCERS).map((producer, index) => (
        <span key={producer.id} className="live-structures-producer">
          {index > 0 ? ' · ' : ''}<code>{producer.id}</code> {number(producer.streams)}
        </span>
      ))}
      {producers.length > VISIBLE_PRODUCERS ? (
        <span title={producers.slice(VISIBLE_PRODUCERS).map(producer => producer.id).join('\n')}>
          {' · '}{t('chat.liveStructuresMoreProducers', { value: number(producers.length - VISIBLE_PRODUCERS) })}
        </span>
      ) : null}
    </p>
  ) : null;

  const viewers = selected.length > 0 ? (
    <section className="live-structures-viewers" aria-label={t('chat.liveStructuresViewers')} data-count={selected.length}>
      {selected.map(key => {
        const id = liveStructureKey(key);
        const frame = frameByKey.get(id);
        const row = rowByKey.get(id);
        const energy = row ? liveStructureCell(row, 'energy') : '';
        const step = row ? liveStructureCell(row, 'step') : '';
        return (
          <figure key={id} className="live-structures-viewer" data-stream={key.id}>
            <figcaption className="live-structures-viewer-head">
              <span className="live-structures-viewer-title"><strong>{key.id}</strong> <code>{key.producer}</code></span>
              {row ? <span className={`plugin-report-tag ${STATUS_TAG[row.status]}`}>{t(STATUS_LABEL[row.status])}</span> : null}
              {step ? <span className="plugin-report-meta">{t('chat.liveStructuresColumnStep')} {step}</span> : null}
              {energy ? <span className="plugin-report-meta">{energy}</span> : null}
              {openButton(key)}
              <button type="button" className="live-structures-icon-button live-structures-stop-watching" aria-label={t('chat.liveStructuresStopWatching', { id: key.id })}
                onClick={() => toggle(key)}><X size={14} aria-hidden="true" /></button>
            </figcaption>
            <div className="live-structures-viewer-body">
              {frame
                ? (renderViewer ? renderViewer(frame) : <LiveStructureFrameViewer frame={frame} />)
                : <p className="live-structures-viewer-note" role="status">{t('chat.liveStructuresWaitingFrame')}</p>}
            </div>
          </figure>
        );
      })}
    </section>
  ) : null;

  const table = (
    <div className="live-structures-table-scroll">
      <table className="live-structures-table" aria-rowcount={total + 1} aria-busy={loading || undefined}>
        <caption className="live-structures-sr">{t('chat.liveStructuresTableCaption', { page: page + 1, pages: pageCount })}</caption>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col" className="live-structures-select-cell"><span className="live-structures-sr">{t('chat.liveStructuresWatchColumn')}</span></th>
            {columns.map(column => <th key={column.key} scope="col" className={column.numeric ? 'is-numeric' : undefined}>{column.label}</th>)}
            {onOpenTrajectory ? <th scope="col" className="live-structures-open-cell">{t('chat.liveStructuresColumnTrajectory')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {shownRows.map((row, index) => {
            const checked = isSelected(row);
            const disabled = !checked && full;
            return (
              <tr key={liveStructureKey(row)} aria-rowindex={page * pageSize + index + 2} aria-selected={checked}
                data-status={row.status} className={checked ? 'is-selected' : undefined}
                onClick={event => {
                  if (disabled || (event.target as HTMLElement).closest('input,button,a')) return;
                  toggle(row);
                }}>
                <td className="live-structures-select-cell">
                  <input type="checkbox" checked={checked} disabled={disabled}
                    aria-label={t('chat.liveStructuresWatch', { id: row.id })} onChange={() => toggle(row)} />
                </td>
                {columns.map(column => column.key === 'status' ? (
                  <td key={column.key}><span className={`plugin-report-tag ${STATUS_TAG[row.status]}`}>{t(STATUS_LABEL[row.status])}</span></td>
                ) : (
                  <td key={column.key} className={column.numeric || column.key === 'energy' ? 'is-numeric' : undefined}
                    title={column.key === 'id' ? `${row.producer} / ${row.id}` : undefined}>
                    {liveStructureCell(row, column.key)}
                  </td>
                ))}
                {onOpenTrajectory ? <td className="live-structures-open-cell">{openButton(row)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {shownRows.length === 0 ? (
        <p className="live-structures-note" role="status">{loading ? t('chat.liveStructuresLoading') : t('chat.liveStructuresNoRows')}</p>
      ) : null}
    </div>
  );

  return (
    <section className={`live-structures ${className}`.trim()} data-ended={ended ? 'true' : 'false'} aria-label={typeof title === 'string' ? title : t('chat.liveStructures')}>
      <header className="live-structures-head">
        <button type="button" className="live-structures-toggle" aria-expanded={open} aria-controls={bodyId}
          aria-label={open ? t('chat.liveStructuresHide') : t('chat.liveStructuresShow')} onClick={() => setOpen(value => !value)}>
          <ChevronDown size={14} aria-hidden="true" className="live-structures-chevron" />
          <span className="live-structures-title">{title ?? t('chat.liveStructures')}</span>
        </button>
        <span className={`plugin-report-tag ${ended ? '' : 'is-accent'}`}>{ended ? t('chat.liveStructuresEnded') : t('chat.liveStructuresLive')}</span>
        {totalsNode}
      </header>
      <div id={bodyId} className="live-structures-body" hidden={!open}>
        {producersNode}
        {ended ? <p className="live-structures-note">{t('chat.liveStructuresEndedNote')}</p> : null}
        {error ? <p className="plugin-report-error" role="alert">{error}</p> : null}
        {totals.streams === 0 && rows.length === 0 ? (
          <p className="live-structures-note" role="status">{t('chat.liveStructuresEmpty')}</p>
        ) : (
          <>
            {viewers}
            <p className="live-structures-selection plugin-report-meta" aria-live="polite">
              {selected.length === 0
                ? t('chat.liveStructuresSelectHint', { max: maxSelected })
                : full
                  ? t('chat.liveStructuresSelectionFull', { max: maxSelected })
                  : t('chat.liveStructuresSelection', { count: selected.length, max: maxSelected })}
            </p>
            {table}
            <nav className="live-structures-pager" aria-label={t('chat.liveStructuresPage', { page: page + 1, pages: pageCount })}>
              <button type="button" className="live-structures-icon-button" aria-label={t('chat.liveStructuresPrevious')}
                disabled={page <= 0} onClick={() => changePage(page - 1)}><ChevronLeft size={14} aria-hidden="true" /></button>
              <span>{t('chat.liveStructuresPage', { page: number(page + 1), pages: number(pageCount) })}</span>
              <button type="button" className="live-structures-icon-button" aria-label={t('chat.liveStructuresNext')}
                disabled={page >= pageCount - 1} onClick={() => changePage(page + 1)}><ChevronRight size={14} aria-hidden="true" /></button>
              <span className="plugin-report-meta">{t('chat.liveStructuresRange', { from: number(first), to: number(last), total: number(total) })}</span>
              {loading ? <span className="plugin-report-meta" role="status">{t('chat.liveStructuresLoading')}</span> : null}
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
