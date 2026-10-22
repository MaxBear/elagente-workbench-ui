import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const clamp = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
type Point = { x: number; y: number };
type View = Point & { scale: number };

/** One gesture engine for workspace previews and chat lightboxes. Pointer state
 * stays synchronous even when several move events arrive before a React render. */
export function useImageViewport() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const current = useRef(view);
  const pointers = useRef(new Map<number, Point>());
  const baseline = useRef<{ view: View; center: Point; distance: number } | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const commit = (next: View) => { current.current = next; setView(next); };
  function centerAndDistance() {
    const points = [...pointers.current.values()].slice(0, 2);
    const a = points[0];
    if (!a) return null;
    const b = points[1] ?? a;
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function restartGesture() {
    const points = centerAndDistance();
    baseline.current = points ? { ...points, view: current.current } : null;
    setDragging(pointers.current.size > 0);
  }
  function local(point: Point) {
    const element = viewportRef.current;
    if (!element) return point;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: point.x - rect.left - (rect.width + parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')) / 2,
      y: point.y - rect.top - (rect.height + parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')) / 2,
    };
  }
  function updateScale(scale: number, clientX?: number, clientY?: number) {
    const old = current.current;
    const next = clamp(scale);
    const anchor = clientX === undefined || clientY === undefined ? { x: 0, y: 0 } : local({ x: clientX, y: clientY });
    const ratio = next / old.scale;
    commit({ scale: next, x: anchor.x - (anchor.x - old.x) * ratio, y: anchor.y - (anchor.y - old.y) * ratio });
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    restartGesture();
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const base = baseline.current;
    const points = centerAndDistance();
    if (!base || !points) return;
    const dx = points.center.x - base.center.x;
    const dy = points.center.y - base.center.y;
    if (Math.hypot(dx, dy) > 3 || Math.abs(points.distance - base.distance) > 3) moved.current = true;
    if (pointers.current.size >= 2 && base.distance > 0) {
      const scale = clamp(base.view.scale * points.distance / base.distance);
      const ratio = scale / base.view.scale;
      const start = local(base.center);
      const end = local(points.center);
      commit({ scale, x: end.x - (start.x - base.view.x) * ratio, y: end.y - (start.y - base.view.y) * ratio });
    } else if (base.view.scale > 1) {
      commit({ ...base.view, x: base.view.x + dx, y: base.view.y + dy });
    }
  }
  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    restartGesture();
  }
  return {
    viewportRef, scale: view.scale, dragging, moved,
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
    reset: () => { commit({ x: 0, y: 0, scale: 1 }); restartGesture(); },
    updateScale,
    handlers: {
      onPointerDown, onPointerMove, onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd,
      onWheel: (event: WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        updateScale(current.current.scale + (event.deltaY < 0 ? .25 : -.25), event.clientX, event.clientY);
      },
    },
  };
}
