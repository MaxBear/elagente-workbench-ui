import type { ModelOptionDto, ReasoningEffortDto } from '@remote-codex/shared';

/* Group model policy (ELA-207/ELA-208). The host reads `model/policy` and
   writes `model/policy/update`; this module only describes the view and the
   selection the composer edits. Every preset, group and model comes from the
   view: nothing here names an Agent, role, group or model. */

/** `reasoningEffort: null` is the deliberate upstream Auto, never "Agent default". */
export interface ModelPolicySelectionDto {
  model: string;
  reasoningEffort: ReasoningEffortDto | null;
  settings?: Record<string, unknown>;
}

export interface ModelPolicyPresetDto {
  id: string;
  label: string;
  description?: string | null;
}

export interface ModelPolicyGroupDto {
  id: string;
  label: string;
  description?: string | null;
  members: string[];
  defaultSelection: ModelPolicySelectionDto;
  effectiveSelection: ModelPolicySelectionDto;
  isOverridden: boolean;
  /** The existing `model/list` options this group may use. */
  models: ModelOptionDto[];
}

export interface ModelPolicyViewDto {
  version: number;
  revision: string;
  policyRevision: string;
  /** A declared preset, or null for the custom group selection. */
  presetId: string | null;
  overrides: Record<string, ModelPolicySelectionDto>;
  presets: ModelPolicyPresetDto[];
  groups: ModelPolicyGroupDto[];
  recovery: { code: string; message: string } | null;
}

export interface ModelPolicyUpdateSelection {
  presetId: string | null;
  overrides: Record<string, { model: string; reasoningEffort: ReasoningEffortDto | null }>;
}

/** The two settings-controlled displays. Neither changes the execution selection. */
export type ModelPolicyDisplay = 'presets' | 'groups';

export interface ComposerModelPolicyProps {
  display: ModelPolicyDisplay;
  view: ModelPolicyViewDto | null;
  /** loading: first read; saving: an update is in flight. */
  status: 'loading' | 'ready' | 'saving';
  /** A read or update failure, shown with Retry. */
  error?: string | null;
  /** Why changes cannot be made now, for example while a turn runs. */
  lockedReason?: string | null;
  onUpdate: (selection: ModelPolicyUpdateSelection) => void;
  onRetry: () => void;
}

export function overrideCount(view: ModelPolicyViewDto) {
  return Object.keys(view.overrides).length;
}

export function isCustomSelection(view: ModelPolicyViewDto) {
  return view.presetId == null;
}

export function presetLabel(view: ModelPolicyViewDto, presetId = view.presetId) {
  return view.presets.find((preset) => preset.id === presetId)?.label ?? presetId ?? '';
}

export function modelDisplayName(
  models: ModelOptionDto[],
  model: string | null | undefined,
) {
  return models.find((entry) => entry.model === model)?.displayName || model || '';
}

function plainOverrides(overrides: ModelPolicyViewDto['overrides']) {
  return Object.fromEntries(
    Object.entries(overrides).map(([id, value]) => [
      id,
      { model: value.model, reasoningEffort: value.reasoningEffort ?? null },
    ]),
  );
}

/** Choose a declared preset. Saved overrides are kept but suspended. */
export function selectPreset(view: ModelPolicyViewDto, presetId: string): ModelPolicyUpdateSelection {
  return { presetId, overrides: plainOverrides(view.overrides) };
}

/** Restore the saved group overrides. */
export function selectCustom(view: ModelPolicyViewDto): ModelPolicyUpdateSelection {
  return { presetId: null, overrides: plainOverrides(view.overrides) };
}

/** Edit one group: always activates the custom selection. A selection equal
    to the group default is stored as inheritance, not as an override. */
export function setGroupSelection(
  view: ModelPolicyViewDto,
  groupId: string,
  selection: { model: string; reasoningEffort: ReasoningEffortDto | null } | null,
): ModelPolicyUpdateSelection {
  const overrides = plainOverrides(view.overrides);
  const group = view.groups.find((entry) => entry.id === groupId);
  const inherits = !selection || (group &&
    group.defaultSelection.model === selection.model &&
    (group.defaultSelection.reasoningEffort ?? null) === selection.reasoningEffort);
  if (inherits) delete overrides[groupId];
  else overrides[groupId] = selection;
  return { presetId: null, overrides };
}

/** Delete every saved override and return to the first declared preset. */
export function resetAllOverrides(view: ModelPolicyViewDto): ModelPolicyUpdateSelection {
  return { presetId: view.presets[0]?.id ?? null, overrides: {} };
}

/** A saved override that applies now (custom selection), as opposed to one
    kept while a preset suspends it. */
export function activeOverride(view: ModelPolicyViewDto, groupId: string) {
  return isCustomSelection(view) ? view.overrides[groupId] ?? null : null;
}

export function suspendedOverride(view: ModelPolicyViewDto, groupId: string) {
  return isCustomSelection(view) ? null : view.overrides[groupId] ?? null;
}

/** The effort to keep when a group switches model: the current effort if the
    new model offers it, then the model's own catalog default, then the group
    default when it is the group's default model. Otherwise undefined: the user
    must choose. A model without effort metadata takes upstream Auto (null). */
export function effortForModelSwitch(
  option: ModelOptionDto,
  current: ReasoningEffortDto | null,
  group: ModelPolicyGroupDto,
): ReasoningEffortDto | null | undefined {
  const efforts = option.supportedReasoningEfforts.map((entry) => entry.reasoningEffort);
  if (efforts.length === 0) return null;
  if (current && efforts.includes(current)) return current;
  if (option.defaultReasoningEffort && efforts.includes(option.defaultReasoningEffort))
    return option.defaultReasoningEffort;
  const groupDefault = group.defaultSelection.reasoningEffort;
  if (option.model === group.defaultSelection.model && groupDefault && efforts.includes(groupDefault))
    return groupDefault;
  return undefined;
}
