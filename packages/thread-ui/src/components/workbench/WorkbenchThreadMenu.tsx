import { useEffect, useRef, useState } from 'react';
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
    into the workbench (like ThreadToolsMenu) so the workbench theme tokens apply. */
export function WorkbenchThreadMenu({ thread, context, copyIdLabel, onNavigate, onRename, onDelete }: {
  thread: WorkbenchThread;
  context?: ThreadMenuContext | undefined;
  copyIdLabel: string;
  onNavigate: (href: string) => void;
  onRename?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  useI18n();
  const place = (left: number, top: number) => ({ left: Math.min(Math.max(8, left), innerWidth - 268), top: Math.max(8, Math.min(top, innerHeight - 340)) });
  const [position, setPosition] = useState<{ top: number; left: number } | null>(() => context ? place(context.x, context.y) : null);
  const [copied, setCopied] = useState<{ key: string; state: 'copied' | 'failed' } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
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
      setPosition(place(box.right - 260, box.bottom + 6));
    }}><MoreHorizontal data-icon="more" size={16} /></button>}
    {position && createPortal(<div ref={menu} role="dialog" aria-label={translate("workbench.threadActions", { value1: thread.title })} className="recent-thread-menu" style={position}>
      <p className="recent-thread-menu-title">{thread.title}</p>
      <button onClick={() => { setPosition(null); onNavigate(thread.href); }}><ExternalLink data-icon="open" size={15} />{translate("workbench.openThread")}</button>
      {copyItem('thread', copyIdLabel, thread.key)}
      {onRename && <button onClick={() => { setPosition(null); onRename(); }}><Pencil data-icon="rename" size={15} />{translate("workbench.renameThread")}</button>}
      {onDelete && <button className="recent-thread-delete" onClick={() => { setPosition(null); onDelete(); }}><Trash2 data-icon="delete" size={15} />{translate("workbench.deleteThread")}</button>}
    </div>, (trigger.current ?? context?.returnFocus)?.closest('.thread-ui-shell') ?? document.body)}
  </>;
}
