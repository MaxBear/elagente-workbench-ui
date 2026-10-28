import { lazy, Suspense, useMemo } from 'react';
import { useI18n } from '../../i18n';
import { RenderErrorBoundary } from '../RenderErrorBoundary';
import { liveStructureKey, type LiveStructureFrame } from './liveStructures';

// The 3Dmol viewer loads only once a stream is watched.
const GraphMoleculeViewer = lazy(() =>
  import('../graph-workspace/GraphMoleculeViewer').then(module => ({ default: module.GraphMoleculeViewer })),
);

/**
 * The shared molecule viewer for one inline frame. The object identity is the
 * stream, not the frame, so a new frame redraws the model and keeps the
 * personal camera, as a streamed trajectory revision does.
 */
export function LiveStructureFrameViewer({ frame }: { frame: LiveStructureFrame }) {
  const { t } = useI18n();
  const key = liveStructureKey(frame);
  const source = useMemo(
    () => ({ content: [frame.xyz], format: frame.format, uuid: key, name: frame.id }),
    [frame.xyz, frame.format, key, frame.id],
  );
  return (
    <RenderErrorBoundary className="live-structures-viewer-error">
      <Suspense fallback={<p className="live-structures-viewer-note" role="status">{t('chat.liveStructuresViewerLoading')}</p>}>
        <GraphMoleculeViewer source={source} moleculeId={key} title={frame.id} presentation="timeline" />
      </Suspense>
    </RenderErrorBoundary>
  );
}
