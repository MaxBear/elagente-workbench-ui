/**
 * @vitest-environment jsdom
 */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelOptionDto } from '@remote-codex/shared';

import { ComposerSettingsToolbar } from './ComposerSettingsToolbar';
import type { ComposerModelPolicyProps, ModelPolicyGroupDto, ModelPolicyViewDto } from './modelPolicy';
import type { SettingsMenu } from './types';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

const option = (model: string, displayName: string, efforts: string[], defaultReasoningEffort: string | null = null): ModelOptionDto => ({
  id: model, model, displayName, description: '', isDefault: false, hidden: false,
  supportedReasoningEfforts: efforts.map((reasoningEffort) => ({ reasoningEffort, description: '' })),
  defaultReasoningEffort,
});

const models = [
  option('alpha-large', 'Alpha Large', ['low', 'medium', 'high']),
  option('beta-small', 'Beta Small', ['minimal', 'low']),
  option('gamma-fixed', 'Gamma Fixed', []),
];

function group(id: string, label: string, overrides: Partial<ModelPolicyGroupDto> = {}): ModelPolicyGroupDto {
  return {
    id, label, description: `${label} description`, members: [`${id}_one`, `${id}_two`],
    defaultSelection: { model: 'alpha-large', reasoningEffort: 'high' },
    effectiveSelection: { model: 'alpha-large', reasoningEffort: 'high' },
    isOverridden: false, models, ...overrides,
  };
}

function policyView(overrides: Partial<ModelPolicyViewDto> = {}): ModelPolicyViewDto {
  return {
    version: 2, revision: 'rev-1', policyRevision: 'policy-1', presetId: 'preset-a', overrides: {},
    presets: [{ id: 'preset-a', label: 'Preset A', description: 'Author defaults.' }],
    groups: [group('planning', 'Planning'), group('helpers', 'Helpers')],
    recovery: null, ...overrides,
  };
}

function render(policy: Partial<ComposerModelPolicyProps> & { view: ModelPolicyViewDto | null }, open: SettingsMenu = 'model') {
  const onUpdate = vi.fn();
  const onRetry = vi.fn();
  function Harness() {
    const [openMenu, setOpenMenu] = useState<SettingsMenu>(open);
    return (
      <form>
        <ComposerSettingsToolbar
          openMenu={openMenu} model="flat-model" modelOptions={[]} modelContextTitle="" contextUsage={null}
          reasoningEffort={null} supportedEfforts={[]} sandboxMode={null} sandboxModeAvailable={false}
          settingsBusy={false} goalComposeMode={false} goalBusy={false} activeView="chat" disabled={false}
          fastMode={false} sendButtonLabel="Send" sendButtonClassName="" modelControlsDisabled={false}
          effortControlsDisabled={false} effortControlTitle="" inlineToggleClassName="" menuItemClassName=""
          sendButtonBaseClassName="" onSetOpenMenu={setOpenMenu} onUpdateSettings={vi.fn()}
          modelPolicy={{ display: 'presets', status: 'ready', onUpdate, onRetry, ...policy }}
        />
      </form>
    );
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness />));
  return { onUpdate, onRetry };
}

const chip = () => document.querySelector<HTMLButtonElement>('[data-testid="composer-model-label"]')!;
const rows = (role = 'menuitemradio') => [...document.querySelectorAll<HTMLButtonElement>(`.composer-model-policy [role="${role}"]`)];
const byText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.composer-model-policy button')].find((button) => button.textContent?.includes(text));
const press = (target: Element, key: string) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });

describe('ComposerModelPolicyMenu', () => {
  it('summarizes a preset on the chip and never one model name', () => {
    render({ view: policyView() }, null);
    expect(chip().textContent).toBe('Preset A');
    expect(chip().textContent).not.toContain('flat-model');
    expect(chip().dataset.modelPolicy).toBe('preset');
  });

  it('summarizes a custom selection with its override count and lists overrides in the title', () => {
    render({ view: policyView({ presetId: null, overrides: { helpers: { model: 'beta-small', reasoningEffort: 'low' } } }) }, null);
    expect(chip().textContent).toBe('Custom models1 override');
    expect(chip().title).toContain('Helpers: Beta Small · low');
    expect(chip().getAttribute('aria-label')).toBe('Models: Custom models, 1 override');
  });

  it('presets display lists only declared presets and never the groups', () => {
    const { onUpdate } = render({ view: policyView() });
    expect(rows().map((row) => row.textContent)).toEqual(['Preset AAuthor defaults.']);
    expect(rows()[0]?.getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.composer-policy-group-row')).toBeNull();
    act(() => rows()[0]!.click());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('presets display states an active custom selection honestly until a preset is chosen', () => {
    const view = policyView({ presetId: null, overrides: { planning: { model: 'beta-small', reasoningEffort: 'low' } } });
    const { onUpdate } = render({ view });
    expect(rows()[0]?.getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[data-tone="info"]')?.textContent).toContain('A custom group selection is active');
    act(() => rows()[0]!.click());
    expect(onUpdate).toHaveBeenCalledWith({ presetId: 'preset-a', overrides: { planning: { model: 'beta-small', reasoningEffort: 'low' } } });
  });

  it('groups display offers presets, Custom with saved overrides, and author groups', () => {
    const view = policyView({ overrides: { helpers: { model: 'beta-small', reasoningEffort: 'low' } } });
    const { onUpdate } = render({ view, display: 'groups' });
    expect(rows().map((row) => row.textContent)).toEqual(['Preset AAuthor defaults.', 'Custom models1 saved override']);
    expect(rows('menuitem').map((row) => row.dataset.groupId)).toEqual(['planning', 'helpers']);
    // Suspended overrides are not shown as applied.
    expect(document.querySelector('[data-group-id="helpers"]')?.hasAttribute('data-overridden')).toBe(false);
    act(() => rows()[1]!.click());
    expect(onUpdate).toHaveBeenCalledWith({ presetId: null, overrides: { helpers: { model: 'beta-small', reasoningEffort: 'low' } } });
  });

  it('shows an applied override with its default and resets all overrides explicitly', () => {
    const view = policyView({
      presetId: null,
      overrides: { helpers: { model: 'beta-small', reasoningEffort: 'low' } },
      groups: [group('planning', 'Planning'), group('helpers', 'Helpers', { isOverridden: true, effectiveSelection: { model: 'beta-small', reasoningEffort: 'low' } })],
    });
    const { onUpdate } = render({ view, display: 'groups' });
    const row = document.querySelector('[data-group-id="helpers"]')!;
    expect(row.textContent).toContain('Override');
    expect(row.textContent).toContain('Beta Small · low (default Alpha Large · high)');
    act(() => byText('Reset 1 override')!.click());
    expect(onUpdate).toHaveBeenCalledWith({ presetId: 'preset-a', overrides: {} });
  });

  it('opens a group with Use group default, the existing model rows and the effort slider', () => {
    const { onUpdate } = render({ view: policyView(), display: 'groups' });
    act(() => rows('menuitem')[0]!.click());
    expect(document.querySelector('.composer-policy-title')?.textContent).toContain('planning · 2 roles');
    expect(rows().map((entry) => [entry.textContent, entry.getAttribute('aria-checked')])).toEqual([
      ['Use group defaultAlpha Large · high', 'true'],
      ['Alpha LargeDefault', 'true'],
      ['Beta Small', 'false'],
      ['Gamma Fixed', 'false'],
    ]);
    expect(document.querySelector('.composer-reasoning-heading')?.textContent).toContain('default high');
    expect(document.activeElement?.textContent).toContain('All groups');
    // A model without effort metadata takes upstream Auto (null) and activates custom.
    act(() => byText('Gamma Fixed')!.click());
    expect(onUpdate).toHaveBeenLastCalledWith({ presetId: null, overrides: { planning: { model: 'gamma-fixed', reasoningEffort: null } } });
  });

  it('waits for an effort when the chosen model does not offer the current one', () => {
    const { onUpdate } = render({ view: policyView(), display: 'groups' });
    act(() => rows('menuitem')[0]!.click());
    act(() => byText('Beta Small')!.click());
    expect(onUpdate).not.toHaveBeenCalled();
    const slider = document.querySelector('.composer-reasoning')!;
    expect(slider.hasAttribute('data-uncommitted')).toBe(true);
    expect(slider.textContent).toContain('Choose effort');
    expect(rows()[0]?.getAttribute('aria-checked')).toBe('false');
    const thumb = document.querySelector<HTMLElement>('[role="slider"]')!;
    act(() => thumb.focus());
    press(thumb, 'ArrowRight');
    expect(onUpdate).toHaveBeenCalledWith({ presetId: null, overrides: { planning: { model: 'beta-small', reasoningEffort: 'minimal' } } });
  });

  it('Use group default removes this group override only', () => {
    const view = policyView({
      presetId: null,
      overrides: { planning: { model: 'beta-small', reasoningEffort: 'low' }, helpers: { model: 'gamma-fixed', reasoningEffort: null } },
      groups: [group('planning', 'Planning', { isOverridden: true, effectiveSelection: { model: 'beta-small', reasoningEffort: 'low' } }), group('helpers', 'Helpers')],
    });
    const { onUpdate } = render({ view, display: 'groups' });
    act(() => rows('menuitem')[0]!.click());
    act(() => byText('Use group default')!.click());
    expect(onUpdate).toHaveBeenCalledWith({ presetId: null, overrides: { helpers: { model: 'gamma-fixed', reasoningEffort: null } } });
  });

  it('Escape in a group returns to the list and restores focus without closing the menu', () => {
    render({ view: policyView(), display: 'groups' });
    act(() => rows('menuitem')[1]!.click());
    press(document.activeElement!, 'Escape');
    expect(document.querySelector('.composer-model-policy-menu')).not.toBeNull();
    expect(document.querySelector('.composer-policy-detail')).toBeNull();
    expect((document.activeElement as HTMLElement).dataset.groupId).toBe('helpers');
  });

  it('shows a read failure with Retry and a busy reason without fake controls', () => {
    const { onRetry } = render({ view: null, error: 'model/policy failed', status: 'ready' }, null);
    expect(chip().textContent).toBe('Model policy unavailable');
    act(() => chip().click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('model/policy failed');
    act(() => byText('Retry')!.click());
    expect(onRetry).toHaveBeenCalled();
  });

  it('asks for an explicit confirmation and treats choosing the current preset as one', () => {
    const { onUpdate } = render({ view: policyView(), confirmationRequired: 'Confirm a preset or group selection before running.' });
    expect(chip().textContent).toBe('Preset AConfirm models');
    expect(document.querySelector('.composer-model-policy [data-tone="warning"]')?.textContent).toContain('Confirm a preset');
    act(() => rows()[0]!.click());
    expect(onUpdate).toHaveBeenCalledWith({ presetId: 'preset-a', overrides: {} });
  });

  it('disables every change while locked and names the reason', () => {
    render({ view: policyView({ presetId: null }), display: 'groups', lockedReason: 'Wait for the current turn to finish.' });
    expect(document.querySelector('.composer-model-policy')?.textContent).toContain('Wait for the current turn to finish.');
    expect(rows().every((row) => row.disabled)).toBe(true);
  });

  it('offers search only for long group lists', () => {
    const groups = Array.from({ length: 10 }, (_, index) => group(`g${index}`, `Group ${index}`));
    render({ view: policyView({ groups }), display: 'groups' });
    const input = document.querySelector<HTMLInputElement>('.composer-policy-search input')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, 'group 3'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(rows('menuitem').map((row) => row.dataset.groupId)).toEqual(['g3']);
    expect(document.querySelector('.composer-policy-section')?.textContent).toContain('1 of 10 groups');
  });
});
