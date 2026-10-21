import { describe, expect, it } from 'vitest';
import type { ModelOptionDto } from '@remote-codex/shared';

import {
  effortForModelSwitch,
  resetAllOverrides,
  selectCustom,
  selectPreset,
  setGroupSelection,
  type ModelPolicyGroupDto,
  type ModelPolicyViewDto,
} from './modelPolicy';

const option = (model: string, efforts: string[], defaultReasoningEffort: string | null = null): ModelOptionDto => ({
  id: model, model, displayName: model.toUpperCase(), description: '', isDefault: false, hidden: false,
  supportedReasoningEfforts: efforts.map((reasoningEffort) => ({ reasoningEffort, description: '' })),
  defaultReasoningEffort,
});

const group: ModelPolicyGroupDto = {
  id: 'g1', label: 'Group one', members: ['a', 'b'],
  defaultSelection: { model: 'm1', reasoningEffort: 'high', settings: { parallelToolCalls: true } },
  effectiveSelection: { model: 'm1', reasoningEffort: 'high' },
  isOverridden: false,
  models: [option('m1', ['low', 'high']), option('m2', ['minimal']), option('m3', [])],
};

const view: ModelPolicyViewDto = {
  version: 2, revision: 'r1', policyRevision: 'p1', presetId: 'defaults',
  overrides: { g2: { model: 'm9', reasoningEffort: null, settings: { ignored: true } } },
  presets: [{ id: 'defaults', label: 'Defaults' }],
  groups: [group], recovery: null,
};

describe('model policy selections', () => {
  it('keeps saved overrides, without settings, when a preset is chosen', () => {
    expect(selectPreset(view, 'defaults')).toEqual({ presetId: 'defaults', overrides: { g2: { model: 'm9', reasoningEffort: null } } });
    expect(selectCustom(view).presetId).toBeNull();
  });

  it('activates the custom selection when a group is edited', () => {
    expect(setGroupSelection(view, 'g1', { model: 'm2', reasoningEffort: 'minimal' })).toEqual({
      presetId: null,
      overrides: { g1: { model: 'm2', reasoningEffort: 'minimal' }, g2: { model: 'm9', reasoningEffort: null } },
    });
  });

  it('stores a selection equal to the group default, or none, as inheritance', () => {
    const custom = { ...view, presetId: null, overrides: { ...view.overrides, g1: { model: 'm2', reasoningEffort: 'minimal' } } };
    expect(setGroupSelection(custom, 'g1', { model: 'm1', reasoningEffort: 'high' }).overrides).not.toHaveProperty('g1');
    expect(setGroupSelection(custom, 'g1', null).overrides).not.toHaveProperty('g1');
  });

  it('resets all overrides to the first declared preset', () => {
    expect(resetAllOverrides(view)).toEqual({ presetId: 'defaults', overrides: {} });
  });

  it('keeps an effort only where the next model offers it, and never guesses', () => {
    expect(effortForModelSwitch(option('m1', ['low', 'high']), 'low', group)).toBe('low');
    expect(effortForModelSwitch(option('m2', ['minimal'], 'minimal'), 'high', group)).toBe('minimal');
    expect(effortForModelSwitch(option('m1', ['low', 'high']), 'xhigh', group)).toBe('high');
    expect(effortForModelSwitch(option('m2', ['minimal']), 'high', group)).toBeUndefined();
    expect(effortForModelSwitch(option('m3', []), 'high', group)).toBeNull();
  });
});
