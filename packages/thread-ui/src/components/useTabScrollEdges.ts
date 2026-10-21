import { useLayoutEffect, useState, type RefObject } from 'react';

/** Edge hints describe the actual scroll range, including after resize or a
 * tab title changes. The hints never intercept a swipe, click or close button. */
export function useTabScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft > 2;
      const end = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      setEdges(current => current.start === start && current.end === end ? current : { start, end });
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(element);
    const mutation = new MutationObserver(update);
    mutation.observe(element, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', update);
    return () => { element.removeEventListener('scroll', update); resize?.disconnect(); mutation.disconnect(); window.removeEventListener('resize', update); };
  }, [ref]);
  return { 'data-overflow-start': edges.start, 'data-overflow-end': edges.end };
}
