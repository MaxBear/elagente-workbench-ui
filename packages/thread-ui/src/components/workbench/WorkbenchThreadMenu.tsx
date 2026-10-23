import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, MoreHorizontal, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { copyText } from '../shell/terminalClipboard';
import { useMenuKeyboard } from '../menu/useMenuKeyboard';
import type { ThreadMenuContext, WorkbenchThread } from '../MatterWorkbench';

/** A thread's menu, for hosts that give the shared layout rename and delete
    callbacks. Adapted from Pockymoe's RecentThreadMenu (apps/supervisor-web,
    Pockymoe b35e997b): the same trigger, menu markup, items and keyboard; the
    host performs the rename and the delete (and confirms it). With `context` it
    opens where the thread was right-clicked and reports when it is done. It portals
    into the workbench (like ThreadToolsMenu) so the workbench theme tokens apply.
    Unlike Pockymoe, a host may draw its own chrome (a navigation rail) beside the
    workbench, so the menu stays inside the workbench's visible box, not just the
    viewport, and is measured once rendered so zoom and its real size are honoured. */
export function WorkbenchThreadMenu({ thread, context, copyIdLabel, onNavigate, onRename, onDelete }: {
  thread: WorkbenchThread;
  context?: ThreadMenuContext | undefined;
  copyIdLabel: string;
  onNavigate: (href: string) => void;
  onRename?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  useI18n();
  const trigger = useRef<HTMLButtonElement>(null);
  const portalHost = () => (trigger.current ?? context?.returnFocus)?.closest<HTMLElement>('.thread-ui-shell') ?? document.body;
  // Where the menu was opened: the ⋯ button's box, or the right-click point.
  const anchor = useRef<{ left: number; top: number; right: number; bottom: number } | null>(
    context ? { left: context.x, top: context.y, right: context.x, bottom: context.y } : null);
  // A first guess from the usual size; the layout effect places the real menu.
  const place = (box: { left: number; top: number; right: number; bottom: number }) => {
    const area = menuArea(portalHost(), 260);
    return { left: clamp(context ? box.left : box.right - 260, area.left + 8, area.right - 268), top: clamp(box.bottom + (context ? 0 : 6), area.top + 8, area.bottom - 340) };
  };
  const [position, setPosition] = useState<{ top: number; left: number } | null>(() => anchor.current ? place(anchor.current) : null);
  const [copied, setCopied] = useState<{ key: string; state: 'copied' | 'failed' } | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Fit the rendered menu once per opening by its measured size: below the
  // anchor, or above it when it does not fit, inside the workbench. The measured
  // offset also corrects for a portal host that positions fixed descendants.
  const fitted = useRef(false);
  useLayoutEffect(() => {
    const node = menu.current;
    if (!position || !node) { fitted.current = false; return; }
    if (fitted.current || !anchor.current) return;
    fitted.current = true;
    const box = node.getBoundingClientRect();
    const area = menuArea(node.parentElement ?? document.body, box.width);
    const at = anchor.current, gap = context ? 0 : 6;
    let top = at.bottom + gap;
    if (top + box.height > area.bottom - 8 && at.top - gap - box.height >= area.top + 8) top = at.top - gap - box.height;
    const left = clamp(context ? at.left : at.right - box.width, area.left + 8, area.right - 8 - box.width);
    top = clamp(top, area.top + 8, area.bottom - 8 - box.height);
    const dx = left - box.left, dy = top - box.top;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) setPosition({ left: position.left + dx, top: position.top + dy });
  }, [position]);
  useEffect(() => {
    if (!position) return;
    setCopied(null);
    const close = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && (menu.current?.contains(event.target as Node) || trigger.current?.contains(event.target as Node))) return;
      setPosition(null);
      if (event.type === 'keydown') (trigger.current ?? context?.returnFocus)?.focus();
    };
    // The menu belongs to its row: scrolling the list away closes it.
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setPosition(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    menu.current?.querySelector('button')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); window.removeEventListener('resize', close); window.removeEventListener('scroll', scroll, true); };
  }, [position]);
  useMenuKeyboard(menu, Boolean(position), (restore) => { setPosition(null); if (restore) (trigger.current ?? context?.returnFocus)?.focus(); }, 'button:not([disabled])');
  // Opened from a right-click, it is done once its menu closes.
  const dismiss = useRef(context?.onClose);
  dismiss.current = context?.onClose;
  useEffect(() => {
    if (context && !position) dismiss.current?.();
  }, [Boolean(context), position]);
  const copyItem = (key: string, label: string, text: string | null | undefined) => {
    const state = copied?.key === key ? copied.state : null;
    return (
      <button data-copy-state={state ?? undefined} disabled={!text} onClick={async () => {
        if (!text) return;
        const ok = await copyText(text);
        setCopied({ key, state: ok ? 'copied' : 'failed' });
        if (ok) window.setTimeout(() => { setCopied(null); setPosition(null); }, 700);
      }}>
        {state === 'copied' ? <Check size={15} /> : state === 'failed' ? <TriangleAlert size={15} /> : <Copy data-icon="copy" size={15} />}
        {state ? translate(state === 'copied' ? 'common.copied' : 'common.copyFailed') : label}
      </button>
    );
  };
  return <>
    {!context && <button ref={trigger} className="recent-thread-actions" aria-label={translate("workbench.actionsFor", { value1: thread.title })} aria-expanded={!!position} aria-haspopup="dialog" onClick={() => {
      if (position) { setPosition(null); return; }
      const box = trigger.current!.getBoundingClientRect();
      anchor.current = { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      setPosition(place(anchor.current));
    }}><MoreHorizontal data-icon="more" size={16} /></button>}
    {position && createPortal(<div ref={menu} role="dialog" aria-label={translate("workbench.threadActions", { value1: thread.title })} className="recent-thread-menu" style={position}>
      <p className="recent-thread-menu-title">{thread.title}</p>
      <button onClick={() => { setPosition(null); onNavigate(thread.href); }}><ExternalLink data-icon="open" size={15} />{translate("workbench.openThread")}</button>
      {copyItem('thread', copyIdLabel, thread.key)}
      {onRename && <button onClick={() => { setPosition(null); onRename(); }}><Pencil data-icon="rename" size={15} />{translate("workbench.renameThread")}</button>}
      {onDelete && <button className="recent-thread-delete" onClick={() => { setPosition(null); onDelete(); }}><Trash2 data-icon="delete" size={15} />{translate("workbench.deleteThread")}</button>}
    </div>, portalHost())}
  </>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** The part of the viewport the workbench occupies; the menu must not leave
    it. A workbench too narrow for the menu leaves it the whole viewport. */
function menuArea(host: HTMLElement, width: number) {
  const workbench = host === document.body ? null : host.getBoundingClientRect();
  const box = workbench && Math.min(innerWidth, workbench.right) - Math.max(0, workbench.left) >= width + 16 ? workbench : null;
  return {
    left: Math.max(0, box?.left ?? 0),
    top: Math.max(0, box?.top ?? 0),
    right: Math.min(innerWidth, box?.right ?? innerWidth),
    bottom: Math.min(innerHeight, box?.bottom ?? innerHeight),
  };
}
