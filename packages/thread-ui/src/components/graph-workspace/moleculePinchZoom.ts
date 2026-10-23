/** Trackpad pinch zoom for the 3Dmol stage.
 *
 * Browsers report a trackpad pinch as a stream of `wheel` events with
 * `ctrlKey` set (Safari also as `gesture*` events). 3Dmol 2.x treats them as
 * mouse-wheel notches: each event moves the camera by a fixed share of its
 * distance from the legacy `wheelDelta`, and its damping term diverges as
 * `wheelDelta` approaches -600. Pinch events arrive every frame, so a short
 * pinch compounds into a jump while the mouse wheel (few, large notches) feels
 * right. Here a pinch scales the view by exactly the amount the fingers asked
 * for; plain wheel and two-finger scroll stay with 3Dmol unchanged, and so
 * does a touch-screen pinch (3Dmol handles touches itself).
 */

/** Chromium and Firefox encode a pinch as deltaY ≈ -100·ln(scale). */
export const PINCH_ZOOM_RATE = 0.01;
/** Largest zoom step one event may apply (a dropped frame must not jump). */
export const PINCH_MAX_STEP = 1.1;

const LINE_PIXELS = 16;
const PAGE_PIXELS = 400;

const clampStep = (factor: number) =>
  Math.min(PINCH_MAX_STEP, Math.max(1 / PINCH_MAX_STEP, factor));

/** Zoom factor for one ctrl+wheel pinch event; above 1 zooms in. */
export function pinchZoomFactor(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
): number {
  const unit =
    event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? PAGE_PIXELS : 1;
  const pixels = event.deltaY * unit;
  if (!Number.isFinite(pixels) || pixels === 0) return 1;
  return clampStep(Math.exp(-pixels * PINCH_ZOOM_RATE));
}

/** Handle pinch on `host` before 3Dmol's canvas listener sees it. */
export function bindPinchZoom(
  host: HTMLElement,
  zoom: (factor: number) => void,
): () => void {
  // Cumulative scale of an active Safari gesture; it owns the pinch while set.
  let gestureScale: number | null = null;
  // Fingers on a touch screen. iOS/iPadOS also report a touch pinch as gesture
  // events, but 3Dmol already zooms from the touches; Mac trackpads send none.
  let touches = 0;
  const track = (event: TouchEvent) => {
    touches = event.touches.length;
  };
  const apply = (factor: number) => {
    if (factor !== 1) zoom(factor);
  };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (gestureScale === null) apply(pinchZoomFactor(event));
  };
  const gestureStart = (event: Event) => {
    event.preventDefault();
    gestureScale = 1;
  };
  const gestureChange = (event: Event) => {
    event.preventDefault();
    const scale = (event as Event & { scale?: unknown }).scale;
    if (gestureScale === null || typeof scale !== 'number' || !(scale > 0)) return;
    if (!touches) apply(clampStep(scale / gestureScale));
    gestureScale = scale;
  };
  const gestureEnd = (event: Event) => {
    event.preventDefault();
    gestureScale = null;
  };
  const options = { capture: true, passive: false } as const;
  host.addEventListener('wheel', wheel, options);
  host.addEventListener('gesturestart', gestureStart, options);
  host.addEventListener('gesturechange', gestureChange, options);
  host.addEventListener('gestureend', gestureEnd, options);
  for (const type of ['touchstart', 'touchend', 'touchcancel'] as const)
    host.addEventListener(type, track, { capture: true, passive: true });
  return () => {
    for (const type of ['touchstart', 'touchend', 'touchcancel'] as const)
      host.removeEventListener(type, track, { capture: true });
    host.removeEventListener('wheel', wheel, options);
    host.removeEventListener('gesturestart', gestureStart, options);
    host.removeEventListener('gesturechange', gestureChange, options);
    host.removeEventListener('gestureend', gestureEnd, options);
  };
}
