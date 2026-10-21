import { translate } from '../i18n';
import type { FrontendPluginModule } from './plugin-types';

export const DEEPSEEK_HARNESS_PLUGIN_ID = 'remote-codex.deepseek-harness';
/** Thread panel the host renders for DeepSeek Harness threads only. */
export const DEEPSEEK_HARNESS_PANEL_KIND = 'harness:deepseek';

// The panel itself belongs to the host app: it drives the device's typed
// harness actions (run modes, DSH plugins, settings, commands, console).
export const deepseekHarnessPlugin: FrontendPluginModule = {
  manifest: {
    id: DEEPSEEK_HARNESS_PLUGIN_ID,
    name: 'DeepSeek Harness',
    version: '0.1.0',
    get description() { return translate('workbench.deepseekHarnessPluginDescription'); },
    remoteCodex: '>=0.12.0',
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [
        { id: 'deepseek-harness', label: 'DeepSeek Harness', kind: DEEPSEEK_HARNESS_PANEL_KIND, artifactTypes: [] },
      ],
    },
  },
  threadPanels: [
    {
      id: 'deepseek-harness',
      kind: DEEPSEEK_HARNESS_PANEL_KIND,
      get label() { return translate('workbench.deepseekHarness'); },
    },
  ],
};
