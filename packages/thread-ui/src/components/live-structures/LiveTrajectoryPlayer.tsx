import { FileText, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatNumber, useI18n, type TranslationKey } from '../../i18n';
import { RenderErrorBoundary } from '../RenderErrorBoundary';
import type { GraphMoleculeViewerSnapshot } from '../graph-workspace/GraphMoleculeViewerData';
import {
  liveStructureCell,
  liveStructureKey,
  liveStructureTrajectoryPath,
  type LiveStructureKey,
  type LiveStructureRow,
  type LiveStructureStatus,
  type LiveTrajectoryFrame,
} from './liveStructures';

const GraphMoleculeViewer = lazy(() =>
  import('../graph-workspace/GraphMoleculeViewer').then(module => ({ default: module.GraphMoleculeViewer })),
);

/** How often a growing trajectory reaches the viewer, at most. */
export const LIVE_TRAJECTORY_UPDATE_MS = 1000;

export interface LiveTrajectoryPlayerProps {
  stream: LiveStructureKey;
  /** The stream's latest summary row: status, step, energy and `trajectory`. */
  row?: LiveStructureRow | null;
  /** Received frames in `seq` order; the host appends to them as the stream grows. */
  frames: readonly LiveTrajectoryFrame[];
  /** Frames before the first one were not kept (evicted or never retained). */
  truncated?: boolean;
  /** Earlier frames are being loaded. */
  loading?: boolean;
  error?: string | null;
  /** The producing turn has ended. */
  ended?: boolean;
  updateIntervalMs?: number;
  /**
   * Opens the durable trajectory file (`summary.trajectory`, workspace-relative)
   * through the host's file viewer. Without it the player stays on live frames.
   */
  onOpenTrajectory?: (path: string) => void;
  /** Opens the file once when the stream is done; default true. */
  autoOpenTrajectory?: boolean;
  onClose?: () => void;
  /** Replaces the default molecule viewer (tests, custom hosts). */
  renderViewer?: (source: GraphMoleculeViewerSnapshot) => ReactNode;
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

/**
 * Publishes `value` at most once per `interval` (the latest one, trailing).
 * The first non-empty value is shown at once.
 */
function useThrottledFrames(value: readonly LiveTrajectoryFrame[], interval: number) {
  const [shown, setShown] = useState(value);
  const publishedAt = useRef(value.length ? Date.now() : 0);
  useEffect(() => {
    if (shown === value) return;
    const publish = () => {
      publishedAt.current = Date.now();
      setShown(value);
    };
    const wait = shown.length === 0 ? 0 : publishedAt.current + interval - Date.now();
    if (wait <= 0) {
      publish();
      return;
    }
    const timer = setTimeout(publish, wait);
    return () => clearTimeout(timer);
  }, [value, shown, interval]);
  // Nothing shown yet: the first frames render in this same pass.
  return shown.length === 0 ? value : shown;
}

/**
 * A side-panel player for one watched stream's trajectory. It plays the
 * frames received so far through the shared molecule viewer (play/pause,
 * frame slider, LIVE follow) and grows as frames arrive, at most once per
 * second, keeping the camera. Once the stream is done and its summary names a
 * durable `trajectory` file, the player hands over to that file.
 */
export function LiveTrajectoryPlayer({
  stream,
  row = null,
  frames,
  truncated = false,
  loading = false,
  error = null,
  ended = false,
  updateIntervalMs = LIVE_TRAJECTORY_UPDATE_MS,
  onOpenTrajectory,
  autoOpenTrajectory = true,
  onClose,
  renderViewer,
  className = '',
}: LiveTrajectoryPlayerProps) {
  const { t } = useI18n();
  const key = liveStructureKey(stream);
  const shown = useThrottledFrames(frames, updateIntervalMs);
  const source = useMemo<GraphMoleculeViewerSnapshot>(
    () => ({ content: shown.map(frame => frame.xyz), format: shown.at(-1)?.format ?? 'xyz', uuid: key, name: stream.id, framesSplit: true }),
    [shown, key, stream.id],
  );
  const path = row?.status === 'done' ? liveStructureTrajectoryPath(row) : null;
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!path || !autoOpenTrajectory || !onOpenTrajectory || opened.current === path) return;
    opened.current = path;
    onOpenTrajectory(path);
  }, [path, autoOpenTrajectory, onOpenTrajectory]);

  const step = row ? liveStructureCell(row, 'step') : '';
  const energy = row ? liveStructureCell(row, 'energy') : '';
  // The header counts what the viewer shows, so both change together.
  const first = shown[0]?.seq;
  const last = shown.at(-1)?.seq;
  return (
    <section className={`live-trajectory ${className}`.trim()} data-stream={stream.id} aria-label={t('chat.liveTrajectoryLabel', { id: stream.id })}>
      <header className="live-trajectory-head">
        <span className="live-structures-viewer-title"><strong>{stream.id}</strong> <code>{stream.producer}</code></span>
        {row ? <span className={`plugin-report-tag ${STATUS_TAG[row.status]}`}>{t(STATUS_LABEL[row.status])}</span> : null}
        {step ? <span className="plugin-report-meta">{t('chat.liveStructuresColumnStep')} {step}</span> : null}
        {energy ? <span className="plugin-report-meta">{energy}</span> : null}
        {onClose ? (
          <button type="button" className="live-structures-icon-button" aria-label={t('chat.liveTrajectoryClose', { id: stream.id })} onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <p className="live-trajectory-meta plugin-report-meta" aria-live="polite">
        {t('chat.liveTrajectoryFrames', { count: shown.length, value: formatNumber(shown.length) })}
        {first !== undefined && last !== undefined ? <> · {t('chat.liveTrajectorySeqRange', { from: formatNumber(first), to: formatNumber(last) })}</> : null}
        {truncated ? <> · {t('chat.liveTrajectoryTruncated')}</> : null}
        {loading ? <> · <span role="status">{t('chat.liveTrajectoryLoading')}</span></> : null}
      </p>
      {ended && !path ? <p className="live-structures-note">{t('chat.liveTrajectoryEnded')}</p> : null}
      {error ? <p className="plugin-report-error" role="alert">{error}</p> : null}
      {path && onOpenTrajectory ? (
        <p className="live-trajectory-file">
          <span>{t('chat.liveTrajectoryFileReady')} <code>{path}</code></span>
          <button type="button" className="live-trajectory-file-button" onClick={() => onOpenTrajectory(path)}>
            <FileText size={14} aria-hidden="true" /> {t('chat.liveTrajectoryOpenFile')}
          </button>
        </p>
      ) : null}
      <div className="live-trajectory-body">
        {shown.length === 0 ? (
          <p className="live-structures-viewer-note" role="status">{loading ? t('chat.liveTrajectoryLoading') : t('chat.liveStructuresWaitingFrame')}</p>
        ) : renderViewer ? renderViewer(source) : (
          <RenderErrorBoundary className="live-structures-viewer-error">
            <Suspense fallback={<p className="live-structures-viewer-note" role="status">{t('chat.liveStructuresViewerLoading')}</p>}>
              <GraphMoleculeViewer source={source} moleculeId={key} title={stream.id} followControl />
            </Suspense>
          </RenderErrorBoundary>
        )}
      </div>
    </section>
  );
}
