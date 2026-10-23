/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bindPinchZoom,
  pinchZoomFactor,
  PINCH_MAX_STEP,
} from './moleculePinchZoom';

// B19: a macOS trackpad pinch arrives as many small ctrl+wheel events.
const wheel = (init: WheelEventInit) =>
  new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
const gesture = (type: string, scale?: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (scale !== undefined) Object.assign(event, { scale });
  return event;
};

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

function stage() {
  const host = document.createElement('div');
  const canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  // Stands in for 3Dmol's own wheel listener on its canvas.
  const threeDmol = vi.fn();
  canvas.addEventListener('wheel', threeDmol);
  const zoom = vi.fn<(factor: number) => void>();
  cleanup = bindPinchZoom(host, zoom);
  return { canvas, threeDmol, zoom };
}

describe('pinchZoomFactor', () => {
  it('follows the fingers: a pinch stream totalling deltaY -100 zooms in e (≈2.7×)', () => {
    // Chrome on macOS: ~60 events of fractional pixel deltas per gesture.
    const events = Array.from({ length: 40 }, () => ({ deltaY: -2.5, deltaMode: 0 }));
    const total = events.reduce((scale, event) => scale * pinchZoomFactor(event), 1);
    expect(total).toBeCloseTo(Math.E, 5);
  });

  it('zooms out on a positive delta, ignores empty events and normalises line mode', () => {
    expect(pinchZoomFactor({ deltaY: 3, deltaMode: 0 })).toBeLessThan(1);
    expect(pinchZoomFactor({ deltaY: 0, deltaMode: 0 })).toBe(1);
    expect(pinchZoomFactor({ deltaY: Number.NaN, deltaMode: 0 })).toBe(1);
    // Firefox line mode: 0.25 line == 4 px.
    expect(pinchZoomFactor({ deltaY: -0.25, deltaMode: 1 })).toBeCloseTo(
      pinchZoomFactor({ deltaY: -4, deltaMode: 0 }),
      10,
    );
  });

  it('bounds one event so a dropped frame cannot jump the camera', () => {
    expect(pinchZoomFactor({ deltaY: -500, deltaMode: 0 })).toBe(PINCH_MAX_STEP);
    expect(pinchZoomFactor({ deltaY: 500, deltaMode: 0 })).toBe(1 / PINCH_MAX_STEP);
  });
});

describe('bindPinchZoom', () => {
  it('takes ctrl+wheel pinch away from 3Dmol and the page, and leaves the mouse wheel to 3Dmol', () => {
    const { canvas, threeDmol, zoom } = stage();
    const pinch = wheel({ deltaY: -2, ctrlKey: true });
    canvas.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
    expect(threeDmol).not.toHaveBeenCalled();
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoom.mock.calls[0]![0]).toBeCloseTo(Math.exp(0.02), 10);

    canvas.dispatchEvent(wheel({ deltaY: 100, deltaMode: 0 }));
    expect(threeDmol).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
  });

  it('uses Safari gesture scale once and ignores its duplicate ctrl+wheel events', () => {
    const { canvas, threeDmol, zoom } = stage();
    canvas.dispatchEvent(gesture('gesturestart'));
    canvas.dispatchEvent(gesture('gesturechange', 1.05));
    canvas.dispatchEvent(wheel({ deltaY: -5, ctrlKey: true }));
    canvas.dispatchEvent(gesture('gesturechange', 1.1));
    const end = gesture('gestureend');
    canvas.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);
    expect(threeDmol).not.toHaveBeenCalled();
    expect(zoom.mock.calls.map(([factor]) => factor).reduce((a, b) => a * b, 1)).toBeCloseTo(1.1, 10);

    canvas.dispatchEvent(wheel({ deltaY: -5, ctrlKey: true }));
    expect(zoom).toHaveBeenCalledTimes(3);
  });

  it('stops handling pinch once unbound', () => {
    const { canvas, threeDmol, zoom } = stage();
    cleanup?.();
    cleanup = undefined;
    canvas.dispatchEvent(wheel({ deltaY: -2, ctrlKey: true }));
    expect(zoom).not.toHaveBeenCalled();
    expect(threeDmol).toHaveBeenCalledTimes(1);
  });
});
