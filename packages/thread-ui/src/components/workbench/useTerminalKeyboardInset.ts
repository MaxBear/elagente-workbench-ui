import { useEffect, useState, type RefObject } from 'react';

/** Reserve real layout space, so both the PTY and its key bar fit above the IME.
 * Chromium's resizes-content mode needs no extra inset; visual-only browsers do.
 */
export function useTerminalKeyboardInset(root: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const node = root.current;
    if (!enabled || !node) { setInset(0); return; }
    let ownsKeyboard = false;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active?.matches('input, textarea, [contenteditable="true"]')) {
          ownsKeyboard = node.contains(active) && Boolean(active.closest('[data-testid="workbench-bottom-panel"]'));
        }
        const viewport = window.visualViewport;
        const keyboardOpen = viewport && window.innerHeight - viewport.height > 80 && viewport.scale === 1;
        if (!keyboardOpen) ownsKeyboard = false;
        const rect = node.getBoundingClientRect();
        const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
        setInset(ownsKeyboard && keyboardOpen ? Math.round(Math.min(rect.height, Math.max(0, rect.bottom - bottom))) : 0);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
    };
  }, [enabled, root]);
  return inset;
}
