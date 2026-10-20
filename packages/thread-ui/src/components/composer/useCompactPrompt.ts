import { useEffect, useRef, useState, type RefObject } from 'react';
import { useWorkbenchPreferences } from '../workbenchPreferences';
import { useContext } from 'react';
import { WorkbenchContext } from '../WorkbenchContext';

export function useCompactPrompt(formRef: RefObject<HTMLFormElement | null>, activeView: string) {
  const preferences = useWorkbenchPreferences();
  const inWorkbench = useContext(WorkbenchContext);
  const [expanded, setExpanded] = useState(false);
  const opening = useRef(false);
  useEffect(() => {
    const form = formRef.current;
    if (!form || !inWorkbench || activeView !== 'chat' || !preferences.compactComposer) return;
    const prompt = () => form.querySelector<HTMLElement>('[role="textbox"]');
    const hasText = () => Boolean(prompt()?.textContent?.trim() || form.querySelector('[data-segment-type="attachment"]'));
    const hasMenu = () => Boolean(form.querySelector('[data-composer-menu-surface]'));
    const inside = (target: EventTarget | null) => target instanceof Node && form.contains(target);
    const down = (event: PointerEvent) => {
      if (inside(event.target)) {
        if (!expanded && window.matchMedia('(max-width: 639px)').matches) {
          opening.current = true;
          event.preventDefault(); event.stopPropagation();
          setExpanded(true);
          prompt()?.focus({preventScroll: true});
          window.setTimeout(() => { opening.current = false; }, 600);
        }
      } else if (!hasText() && !hasMenu()) setExpanded(false);
    };
    const finish = (event: Event) => {
      if (!opening.current) return;
      event.preventDefault(); event.stopPropagation();
      if (event.type === 'click' || event.type === 'pointercancel') opening.current = false;
    };
    inputInitial();
    function inputInitial() { if (hasText() || form?.contains(document.activeElement)) setExpanded(true); }
    const focus = () => setExpanded(true);
    const input = () => { if (hasText()) setExpanded(true); };
    document.addEventListener('pointerdown', down, true);
    for (const name of ['pointerup','mousedown','mouseup','click','pointercancel']) document.addEventListener(name, finish, true);
    form.addEventListener('focusin', focus);
    form.addEventListener('input', input);
    const observer = new MutationObserver(input); observer.observe(form, {subtree:true,childList:true,characterData:true});
    return () => {
      document.removeEventListener('pointerdown', down, true);
      for (const name of ['pointerup','mousedown','mouseup','click','pointercancel']) document.removeEventListener(name, finish, true);
      form.removeEventListener('focusin', focus); form.removeEventListener('input', input); observer.disconnect();
    };
  }, [formRef, activeView, inWorkbench, preferences.compactComposer, expanded]);
  return inWorkbench && activeView === 'chat' && preferences.compactComposer ? expanded ? 'expanded' : 'compact' : undefined;
}
