import { useMemo, useState } from 'react';
import type { ModelOptionDto } from '@remote-codex/shared';
import type {
  ComposerModelPolicyProps,
  ModelPolicyDisplay,
  ModelPolicyGroupDto,
  ModelPolicyUpdateSelection,
  ModelPolicyViewDto,
} from '@remote-codex/thread-ui';

/* Playground fixture for the group model policy menu (`?modelPolicy=presets`
   or `?modelPolicy=groups`, `&policyGroups=12` for a long list). Labels and
   models are illustrative only; a host receives them from its Agent. */

const efforts = (values: string[]) => values.map((reasoningEffort) => ({ reasoningEffort, description: '' }));
const model = (id: string, displayName: string, levels: string[]): ModelOptionDto => ({
  id, model: id, displayName, description: '', isDefault: false, hidden: false,
  supportedReasoningEfforts: efforts(levels), defaultReasoningEffort: null,
});
const catalog = [
  model('fixture-sol', 'Fixture Sol', ['none', 'low', 'medium', 'high', 'xhigh', 'max']),
  model('fixture-terra', 'Fixture Terra', ['none', 'low', 'medium', 'high', 'xhigh', 'max']),
  model('fixture-astra', 'Fixture Astra', ['low', 'medium', 'high', 'xhigh', 'max']),
  model('fixture-haiku', 'Fixture Haiku', []),
];

const baseGroups: Array<[string, string, string, number, string, string | null]> = [
  ['planning', 'Planning', 'Top-level scientific planners', 2, 'fixture-sol', 'high'],
  ['input-generation', 'Input generation', 'Writes and checks calculation inputs', 24, 'fixture-terra', 'medium'],
  ['analysis', 'Analysis', 'Reads results and reports', 9, 'fixture-terra', 'low'],
  ['frequency', 'Frequency removal', 'Imaginary frequency fixes', 1, 'fixture-terra', 'none'],
  ['summarizer', 'Context summarizer', 'Compacts long conversations; automatic effort only', 1, 'fixture-haiku', null],
];

function groupsFor(count: number): Array<[string, string, string, number, string, string | null]> {
  const extra = Array.from({ length: Math.max(0, count - baseGroups.length) }, (_, index) =>
    [`helper-${index + 1}`, `Helper ${index + 1}`, 'Helper role defaults', 1, 'fixture-terra', 'medium'] as [string, string, string, number, string, string | null]);
  return [...baseGroups, ...extra].slice(0, Math.max(1, count));
}

function buildView(selection: ModelPolicyUpdateSelection, revision: number, count: number): ModelPolicyViewDto {
  const custom = selection.presetId == null;
  const groups: ModelPolicyGroupDto[] = groupsFor(count).map(([id, label, description, members, defaultModel, effort]) => {
    const defaultSelection = { model: defaultModel, reasoningEffort: effort };
    const override = custom ? selection.overrides[id] : undefined;
    return {
      id, label, description,
      members: Array.from({ length: members }, (_, index) => `${id.replace(/-/g, '_')}_${index + 1}`),
      defaultSelection, effectiveSelection: override ?? defaultSelection, isOverridden: Boolean(override),
      models: defaultModel === 'fixture-haiku' ? catalog.filter((entry) => entry.id === 'fixture-haiku') : catalog.filter((entry) => entry.id !== 'fixture-haiku'),
    };
  });
  return {
    version: 2, revision: `fixture-${revision}`, policyRevision: 'fixture-policy',
    presetId: selection.presetId, overrides: selection.overrides,
    presets: [{ id: 'agent-defaults', label: 'Agent defaults', description: 'Original scientific models and settings.' }],
    groups, recovery: null,
  };
}

export function usePlaygroundModelPolicy(params: URLSearchParams): ComposerModelPolicyProps | null {
  const display = params.get('modelPolicy');
  const count = Number(params.get('policyGroups')) || baseGroups.length;
  const [state, setState] = useState(() => ({
    revision: 1,
    selection: params.has('policyCustom')
      ? { presetId: null, overrides: { 'input-generation': { model: 'fixture-astra', reasoningEffort: 'high' }, analysis: { model: 'fixture-sol', reasoningEffort: 'medium' } } }
      : { presetId: 'agent-defaults', overrides: {} } as ModelPolicyUpdateSelection,
  }));
  return useMemo(() => display !== 'presets' && display !== 'groups' ? null : {
    display: display as ModelPolicyDisplay,
    view: buildView(state.selection, state.revision, count),
    status: 'ready',
    error: null,
    lockedReason: null,
    onUpdate: (selection) => setState((current) => ({ revision: current.revision + 1, selection })),
    onRetry: () => undefined,
  }, [display, state, count]);
}
