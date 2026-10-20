import { useSyncExternalStore } from 'react';

export interface WorkbenchPreferences {
  theme: 'classic' | 'terminal';
  textSize: number;
  phoneDock: boolean;
  phoneHand: 'left' | 'right';
  compactComposer: boolean;
  autoCollapseWork: boolean;
  reduceMotion: boolean;
}

const KEY = 'elagente.workbench.preferences.v1';
const EVENT = 'elagente-workbench-preferences';
const defaults: WorkbenchPreferences = {
  theme: 'classic', textSize: 100, phoneDock: true, phoneHand: 'right',
  compactComposer: true, autoCollapseWork: true, reduceMotion: false,
};
let cachedRaw: string | null | undefined;
let cached = defaults;

function read(): WorkbenchPreferences {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { return cached; }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  let value: Partial<WorkbenchPreferences> = {};
  try { value = JSON.parse(raw ?? '{}') ?? {}; } catch { /* Ignore invalid saved data. */ }
  cached = {
    theme: value.theme === 'terminal' ? 'terminal' : 'classic',
    textSize: [85, 100, 115, 130].includes(value.textSize ?? 0) ? value.textSize! : 100,
    phoneHand: value.phoneHand === 'left' ? 'left' : 'right',
    phoneDock: typeof value.phoneDock === 'boolean' ? value.phoneDock : defaults.phoneDock,
    compactComposer: typeof value.compactComposer === 'boolean' ? value.compactComposer : true,
    autoCollapseWork: typeof value.autoCollapseWork === 'boolean' ? value.autoCollapseWork : true,
    reduceMotion: value.reduceMotion === true,
  };
  return cached;
}
function subscribe(onChange: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener('storage', storage);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(EVENT, onChange); };
}
export function updateWorkbenchPreferences(update: Partial<WorkbenchPreferences>) {
  const next = {...read(), ...update};
  const raw = JSON.stringify(next);
  try { window.localStorage.setItem(KEY, raw); } catch { /* Keep the current tab usable without storage. */ }
  cachedRaw = undefined; cached = next;
  window.dispatchEvent(new Event(EVENT));
}
export function useWorkbenchPreferences() {
  return useSyncExternalStore(subscribe, read, () => defaults);
}

export function WorkbenchPreferencesPanel() {
  const p = useWorkbenchPreferences();
  const toggle = (key: 'phoneDock' | 'compactComposer' | 'autoCollapseWork' | 'reduceMotion', label: string, description: string) => (
    <label className="workbench-preference-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={p[key]} onChange={e => updateWorkbenchPreferences({[key]: e.target.checked})} />
    </label>
  );
  return <div className="workbench-preferences">
    <fieldset><legend>Appearance</legend>
      <label className="workbench-preference-row"><span><strong>Theme</strong><small>Independent of your light, dark or system color mode.</small></span>
        <select aria-label="Workbench theme" value={p.theme} onChange={e => updateWorkbenchPreferences({theme: e.target.value as WorkbenchPreferences['theme']})}>
          <option value="classic">Classic</option><option value="terminal">Terminal</option>
        </select>
      </label>
      <label className="workbench-preference-row"><span><strong>Conversation text size</strong><small>Scale messages and the prompt; keep controls and scientific canvases unchanged.</small></span>
        <select aria-label="Conversation text size" value={p.textSize} onChange={e => updateWorkbenchPreferences({textSize: Number(e.target.value)})}>
          {[85,100,115,130].map(size => <option key={size} value={size}>{size}%</option>)}
        </select>
      </label>
      {toggle('reduceMotion', 'Reduce motion', 'Use immediate transitions. Your system reduced-motion preference is always respected.')}
    </fieldset>
    <fieldset><legend>Reading</legend>
      {toggle('autoCollapseWork', 'Collapse completed work', 'Keep final replies and scientific results visible; expand tool activity when needed.')}
    </fieldset>
    <fieldset><legend>Phone</legend>
      {toggle('phoneDock', 'One-handed navigation', 'Move conversations, files, tools and settings within thumb reach.')}
      <label className="workbench-preference-row"><span><strong>Preferred hand</strong><small>Place the navigation button on your preferred side.</small></span>
        <select aria-label="Preferred hand" value={p.phoneHand} onChange={e => updateWorkbenchPreferences({phoneHand: e.target.value as WorkbenchPreferences['phoneHand']})}>
          <option value="right">Right</option><option value="left">Left</option>
        </select>
      </label>
      {toggle('compactComposer', 'Compact prompt', 'Fold an empty, inactive prompt. Keep it open while typing or using a menu.')}
    </fieldset>
    <p className="workbench-preference-note">Saved in this browser. These preferences do not change Agent settings or scientific execution.</p>
  </div>;
}
