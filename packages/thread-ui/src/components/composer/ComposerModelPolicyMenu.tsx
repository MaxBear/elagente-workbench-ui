import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ReasoningEffortDto } from '@remote-codex/shared';

import { translate, useI18n } from '../../i18n';
import { formatReasoningEffortLabel } from './composerUtils';
import { ComposerReasoningSlider } from './ComposerReasoningSlider';
import {
  activeOverride,
  effortForModelSwitch,
  isCustomSelection,
  modelDisplayName,
  overrideCount,
  resetAllOverrides,
  selectCustom,
  selectPreset,
  setGroupSelection,
  suspendedOverride,
  type ComposerModelPolicyProps,
  type ModelPolicyGroupDto,
  type ModelPolicySelectionDto,
  type ModelPolicyViewDto,
} from './modelPolicy';

/* The group layer inside the existing composer model menu (approved design in
   cloud docs/work-plan/role-model-selection-review.md, with author groups in
   place of individual roles). The model rows, effort slider, heading note and
   menu surface are the composer's own; only the preset/group list and the back
   row are new. */

const ROW =
  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60';
/** Search and filters appear only for long author group lists. */
const SEARCH_THRESHOLD = 8;

function selectionText(models: ModelPolicyGroupDto['models'], selection: ModelPolicySelectionDto) {
  const name = modelDisplayName(models, selection.model);
  const option = models.find((entry) => entry.model === selection.model);
  // A model without effort metadata has no effort to show; Auto is shown only
  // when the model offers levels and none was chosen deliberately.
  return selection.reasoningEffort === undefined ||
    (selection.reasoningEffort === null && option && option.supportedReasoningEfforts.length === 0)
    ? name
    : `${name} · ${formatReasoningEffortLabel(selection.reasoningEffort)}`;
}

/** Arrow keys move between the menu's rows, as in the other composer menus. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const target = event.target as HTMLElement;
  if (target.closest('.composer-reasoning')) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-policy-row]:not(:disabled)')];
  if (!rows.length) return;
  event.preventDefault();
  const current = rows.indexOf(target);
  const next = current < 0 ? 0 : (current + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
  rows[next]?.focus();
}

function PolicyHeading({ title, queueing, liveModelSwitch, saving }: {
  title: string; queueing: boolean; liveModelSwitch: boolean; saving: boolean;
}) {
  return (
    <p className="composer-model-menu-heading flex items-baseline justify-between gap-3 px-2 py-1 text-xs text-[var(--theme-fg-muted)]">
      <span>{title}</span>
      {saving ? (
        <span className="composer-model-menu-note text-[11px]" role="status">{translate('chat.policySaving')}</span>
      ) : queueing ? (
        <span className="composer-model-menu-note text-[11px]">
          {translate(liveModelSwitch ? 'chat.modelSwitchNextCall' : 'chat.modelSwitchNextTurn')}
        </span>
      ) : null}
    </p>
  );
}

function PolicyNotices({ policy }: { policy: ComposerModelPolicyProps }) {
  const { view, error, lockedReason, confirmationRequired } = policy;
  return (
    <>
      {confirmationRequired ? (
        <p className="composer-policy-notice" data-tone="warning" role="status">{confirmationRequired}</p>
      ) : null}
      {view?.recovery ? (
        <p className="composer-policy-notice" data-tone="warning" role="status">{view.recovery.message}</p>
      ) : null}
      {lockedReason ? <p className="composer-policy-notice" role="status">{lockedReason}</p> : null}
      {error ? (
        <div className="composer-policy-notice" data-tone="danger" role="alert">
          <span>{error}</span>
          <button type="button" data-policy-row className="composer-policy-link" onClick={policy.onRetry}>
            {translate('chat.retry')}
          </button>
        </div>
      ) : null}
    </>
  );
}

function PresetRows({ view, disabled, onUpdate, withCustom, confirm }: {
  view: ModelPolicyViewDto; disabled: boolean; withCustom: boolean;
  onUpdate: ComposerModelPolicyProps['onUpdate'];
  /** Re-choosing the current selection is an explicit confirmation. */
  confirm: boolean;
}) {
  const saved = overrideCount(view);
  const custom = isCustomSelection(view);
  return (
    <div className="composer-policy-presets">
      {view.presets.map((preset) => (
        <button key={preset.id} type="button" role="menuitemradio" data-policy-row
          aria-checked={view.presetId === preset.id} disabled={disabled}
          onClick={() => { if (confirm || view.presetId !== preset.id) onUpdate(selectPreset(view, preset.id)); }}
          className={ROW}>
          <span className="composer-policy-row-copy">
            <span className="composer-policy-row-title">{preset.label}</span>
            {preset.description ? <span className="composer-policy-row-detail">{preset.description}</span> : null}
          </span>
          {view.presetId === preset.id ? <Check size={14} className="shrink-0" /> : null}
        </button>
      ))}
      {withCustom && (custom || saved > 0) ? (
        <button type="button" role="menuitemradio" data-policy-row aria-checked={custom} disabled={disabled}
          onClick={() => { if (confirm || !custom) onUpdate(selectCustom(view)); }} className={ROW}>
          <span className="composer-policy-row-copy">
            <span className="composer-policy-row-title">{translate('chat.policyCustom')}</span>
            <span className="composer-policy-row-detail">
              {saved ? translate('chat.policySavedOverrides', { count: saved }) : translate('chat.policyNoOverrides')}
            </span>
          </span>
          {custom ? <Check size={14} className="shrink-0" /> : null}
        </button>
      ) : null}
    </div>
  );
}

function GroupRow({ view, group, onOpen }: {
  view: ModelPolicyViewDto; group: ModelPolicyGroupDto; onOpen: () => void;
}) {
  const override = activeOverride(view, group.id);
  return (
    <button type="button" role="menuitem" aria-haspopup="menu" data-policy-row data-group-id={group.id}
      data-overridden={override ? 'true' : undefined} onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); onOpen(); } }}
      className={`${ROW} composer-policy-group-row`}>
      <span className="composer-policy-row-copy">
        <span className="composer-policy-row-title">
          {group.label}
          {override ? <span className="composer-policy-tag">{translate('chat.policyOverride')}</span> : null}
        </span>
        <span className="composer-policy-row-detail">
          {selectionText(group.models, group.effectiveSelection)}
          {override ? (
            <span className="composer-policy-default">
              {' '}({translate('chat.policyDefaultIn', { value1: selectionText(group.models, group.defaultSelection) })})
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-[var(--theme-fg-muted)]" />
    </button>
  );
}

function GroupDetail({ view, group, disabled, onUpdate, onBack, onDone, queueing, liveModelSwitch, saving }: {
  view: ModelPolicyViewDto; group: ModelPolicyGroupDto; disabled: boolean;
  onUpdate: ComposerModelPolicyProps['onUpdate']; onBack: () => void; onDone: () => void;
  queueing: boolean; liveModelSwitch: boolean; saving: boolean;
}) {
  const override = activeOverride(view, group.id);
  const suspended = suspendedOverride(view, group.id);
  // A model whose efforts do not include the current one waits for a choice.
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  useEffect(() => setPendingModel(null), [view.revision]);
  const selection = group.effectiveSelection;
  const shownModel = pendingModel ?? selection.model;
  const option = group.models.find((entry) => entry.model === shownModel);
  const efforts = option?.supportedReasoningEfforts ?? [];
  const defaultEffort = group.defaultSelection.reasoningEffort;
  const commit = (model: string, reasoningEffort: ReasoningEffortDto | null) => {
    setPendingModel(null);
    onUpdate(setGroupSelection(view, group.id, { model, reasoningEffort }));
  };
  const backRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="composer-policy-detail" onKeyDown={(event) => {
      if ((event.key === 'ArrowLeft' && !(event.target as HTMLElement).closest('.composer-reasoning')) || event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); onBack();
      }
    }}>
      <div className="composer-policy-nav">
        <button ref={backRef} type="button" data-policy-row onClick={onBack} className="composer-policy-back">
          <ChevronLeft size={14} aria-hidden="true" />{translate('chat.policyAllGroups')}
        </button>
        <button type="button" onClick={onDone} className="composer-policy-done">{translate('chat.policyDone')}</button>
      </div>
      <div className="composer-policy-detail-body">
        <PolicyHeading title={translate('chat.policyGroups')} queueing={queueing} liveModelSwitch={liveModelSwitch} saving={saving} />
        <div className="composer-policy-title" aria-live="polite">
          <strong>{group.label}</strong>
          <code title={group.members.join(', ')}>{group.id} · {translate('chat.policyMembers', { count: group.members.length })}</code>
          {group.description ? <span>{group.description}</span> : null}
        </div>
        {suspended ? (
          <p className="composer-policy-notice" role="status">
            {translate('chat.policySuspended', { value1: selectionText(group.models, suspended) })}
          </p>
        ) : null}
        <div className="composer-policy-models">
          <div role="group" aria-label={translate('chat.policyUseGroupDefault')}>
            <button type="button" role="menuitemradio" data-policy-row aria-checked={!override && !pendingModel}
              disabled={disabled} className={ROW}
              onClick={() => { setPendingModel(null); if (override) onUpdate(setGroupSelection(view, group.id, null)); }}>
              <span className="composer-policy-row-copy">
                <span className="composer-policy-row-title">{translate('chat.policyUseGroupDefault')}</span>
                <span className="composer-policy-row-detail">{selectionText(group.models, group.defaultSelection)}</span>
              </span>
              {!override && !pendingModel ? <Check size={14} className="shrink-0" /> : null}
            </button>
          </div>
          {/* The model rows are their own radio group: the effective model. */}
          <div role="group" aria-label={translate('chat.model')}>
            {group.models.length === 0 ? (
              <p className="composer-policy-notice">{translate('chat.policyNoModels')}</p>
            ) : null}
            {group.models.map((entry) => (
              <button key={entry.id} type="button" role="menuitemradio" data-policy-row
                aria-checked={entry.model === shownModel} disabled={disabled} className={ROW}
                onClick={() => {
                  if (entry.model === shownModel) return;
                  const effort = effortForModelSwitch(entry, selection.reasoningEffort ?? null, group);
                  if (effort === undefined) setPendingModel(entry.model);
                  else commit(entry.model, effort);
                }}>
                <span className="composer-policy-row-title">
                  {entry.displayName}
                  {entry.model === group.defaultSelection.model ? (
                    <span className="composer-policy-tag" data-tone="muted">{translate('chat.policyDefaultTag')}</span>
                  ) : null}
                </span>
                {entry.model === shownModel ? <Check size={14} className="shrink-0" /> : null}
              </button>
            ))}
          </div>
        </div>
        {efforts.length > 0 ? (
          <ComposerReasoningSlider
            key={`${group.id}:${shownModel}`}
            efforts={efforts}
            effort={pendingModel ? null : selection.reasoningEffort}
            defaultEffort={pendingModel ? null : option?.defaultReasoningEffort}
            uncommitted={Boolean(pendingModel)}
            hint={shownModel === group.defaultSelection.model && defaultEffort
              ? translate('chat.policyDefaultEffort', { value1: formatReasoningEffortLabel(defaultEffort) })
              : undefined}
            disabled={disabled}
            onCommit={(next) => commit(shownModel, next)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ComposerModelPolicyMenu({ policy, queueing, liveModelSwitch, onClose }: {
  policy: ComposerModelPolicyProps;
  queueing: boolean;
  liveModelSwitch: boolean;
  onClose: () => void;
}) {
  useI18n();
  const { view, display, status } = policy;
  const saving = status === 'saving';
  const disabled = saving || Boolean(policy.lockedReason) || !view;
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const restoreFocus = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openGroup = display === 'groups' ? view?.groups.find((group) => group.id === openGroupId) ?? null : null;

  const back = () => { restoreFocus.current = openGroupId; setOpenGroupId(null); };
  const backOnPop = useRef(back);
  backOnPop.current = back;
  useLayoutEffect(() => {
    if (openGroup || !restoreFocus.current) return;
    const id = restoreFocus.current;
    restoreFocus.current = null;
    [...(listRef.current?.querySelectorAll<HTMLElement>('[data-group-id]') ?? [])]
      .find((row) => row.dataset.groupId === id)?.focus({ preventScroll: true });
  }, [openGroup]);

  // Phones: the system back gesture returns from a group to the list.
  useEffect(() => {
    if (!openGroupId || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 639px)').matches) return;
    const marker = `composer-policy-${Date.now()}`;
    history.pushState({ ...history.state, composerPolicy: marker }, '');
    const onPop = () => backOnPop.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.composerPolicy === marker) {
        const state = { ...history.state };
        delete state.composerPolicy;
        history.replaceState(state, '');
      }
    };
  }, [openGroupId]);

  const groups = view?.groups ?? [];
  const searchable = groups.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => !view ? [] : view.groups.filter((group) => {
    if (onlyOverridden && !activeOverride(view, group.id)) return false;
    if (!needle) return true;
    return [group.label, group.id, group.description ?? '', modelDisplayName(group.models, group.effectiveSelection.model)]
      .some((value) => value.toLowerCase().includes(needle));
  }), [view, needle, onlyOverridden]);

  if (!view) {
    return (
      <div className="composer-model-policy" data-display={display}>
        <PolicyHeading title={translate(display === 'groups' ? 'chat.policyGroups' : 'chat.policyPresets')}
          queueing={queueing} liveModelSwitch={liveModelSwitch} saving={false} />
        {policy.error ? <PolicyNotices policy={policy} /> : (
          <p className="composer-policy-notice" role="status">{translate('chat.policyLoading')}</p>
        )}
      </div>
    );
  }

  if (openGroup) {
    return (
      <div className="composer-model-policy" data-display={display} data-level="group">
        <PolicyNotices policy={policy} />
        <GroupDetail view={view} group={openGroup} disabled={disabled} onUpdate={policy.onUpdate}
          onBack={back} onDone={onClose} queueing={queueing} liveModelSwitch={liveModelSwitch} saving={saving} />
      </div>
    );
  }

  const custom = isCustomSelection(view);
  const saved = overrideCount(view);
  if (display === 'presets') {
    return (
      <div className="composer-model-policy" data-display="presets" onKeyDown={moveFocus}>
        <PolicyHeading title={translate('chat.policyPresets')} queueing={queueing} liveModelSwitch={liveModelSwitch} saving={saving} />
        <PolicyNotices policy={policy} />
        <PresetRows view={view} disabled={disabled} onUpdate={policy.onUpdate} withCustom={false} confirm={Boolean(policy.confirmationRequired)} />
        {custom ? (
          <div className="composer-policy-notice" data-tone="info" role="status">
            <strong>{translate('chat.policyCustomActive')}</strong>
            <span>{saved ? translate('chat.policyOverrideCount', { count: saved }) : translate('chat.policyNoOverrides')}</span>
            <span>{translate('chat.policyCustomActiveHint')}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={listRef} className="composer-model-policy" data-display="groups" data-level="list" onKeyDown={moveFocus}>
      <PolicyHeading title={translate('chat.policyGroups')} queueing={queueing} liveModelSwitch={liveModelSwitch} saving={saving} />
      <PolicyNotices policy={policy} />
      <PresetRows view={view} disabled={disabled} onUpdate={policy.onUpdate} withCustom confirm={Boolean(policy.confirmationRequired)} />
      {searchable ? (
        <div className="composer-policy-search">
          <label>
            <Search size={13} aria-hidden="true" />
            <input type="search" value={query} placeholder={translate('chat.policySearch')} aria-label={translate('chat.policySearch')}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && visible[0]) { event.preventDefault(); setOpenGroupId(visible[0].id); }
              }} />
          </label>
          {custom && saved ? (
            <button type="button" aria-pressed={onlyOverridden} className="composer-policy-filter"
              onClick={() => setOnlyOverridden((value) => !value)}>
              {translate('chat.policyOverrideCount', { count: saved })}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="composer-policy-section">
        <span>{translate('chat.policyGroupsHeading')}</span>
        {searchable && needle ? (
          <span>{translate('chat.policySearchCount', { value1: visible.length, value2: groups.length })}</span>
        ) : <span>{groups.length}</span>}
      </p>
      <div className="composer-policy-groups">
        {visible.map((group) => (
          <GroupRow key={group.id} view={view} group={group} onOpen={() => setOpenGroupId(group.id)} />
        ))}
        {searchable && visible.length === 0 ? (
          <p className="composer-policy-notice">
            {translate('chat.policyNoMatch', { value1: query.trim() })}{' '}
            <button type="button" className="composer-policy-link" onClick={() => { setQuery(''); setOnlyOverridden(false); }}>
              {translate('chat.policyClearSearch')}
            </button>
          </p>
        ) : null}
      </div>
      {saved > 0 ? (
        <button type="button" data-policy-row disabled={disabled} className="composer-policy-reset"
          onClick={() => policy.onUpdate(resetAllOverrides(view))}>
          {translate('chat.policyResetAll', { count: saved })}
        </button>
      ) : null}
    </div>
  );
}
