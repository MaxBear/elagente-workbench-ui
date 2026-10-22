// src/registry.ts
var PluginRegistry = class {
  plugins = /* @__PURE__ */ new Map();
  enabled = /* @__PURE__ */ new Map();
  constructor(plugins = []) {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }
  register(plugin) {
    if (this.plugins.has(plugin.manifest.id)) {
      throw new Error(`Plugin is already registered: ${plugin.manifest.id}`);
    }
    this.plugins.set(plugin.manifest.id, plugin);
    this.enabled.set(plugin.manifest.id, plugin.enabledByDefault ?? true);
  }
  updateImported(plugin) {
    const existing = this.plugins.get(plugin.manifest.id);
    if (existing && existing.source !== "imported") {
      throw new Error(`Built-in plugin cannot be replaced: ${plugin.manifest.id}`);
    }
    this.plugins.set(plugin.manifest.id, {
      ...plugin,
      source: "imported"
    });
    this.enabled.set(plugin.manifest.id, plugin.enabledByDefault ?? true);
  }
  list() {
    return [...this.plugins.values()].map(
      (plugin) => this.toDto(plugin.manifest)
    );
  }
  get(pluginId) {
    const plugin = this.plugins.get(pluginId);
    return plugin ? this.toDto(plugin.manifest) : null;
  }
  getManifest(pluginId) {
    return this.plugins.get(pluginId)?.manifest ?? null;
  }
  getRegistered(pluginId) {
    return this.plugins.get(pluginId) ?? null;
  }
  isEnabled(pluginId) {
    return this.enabled.get(pluginId) ?? false;
  }
  setEnabled(pluginId, enabled) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin is not registered: ${pluginId}`);
    }
    this.enabled.set(pluginId, enabled);
    return this.toDto(plugin.manifest);
  }
  enabledManifests() {
    return [...this.plugins.values()].filter((plugin) => this.isEnabled(plugin.manifest.id)).map((plugin) => plugin.manifest);
  }
  toDto(manifest) {
    return {
      ...manifest,
      enabled: this.isEnabled(manifest.id),
      source: this.plugins.get(manifest.id)?.source ?? "builtin"
    };
  }
};

// src/artifacts.ts
var artifactFenceLanguages = /* @__PURE__ */ new Set(["artifact", "remote-codex-artifact"]);
var pockymoeMoleculeMcpToolName = "remote_codex_render_molecule";
function stableArtifactId(input) {
  return [
    "artifact",
    input.pluginId.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    input.artifactType.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    input.turnId.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    input.itemId.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    input.index
  ].join(":");
}
function artifactItemFromArtifact(artifact, sourceItem, sequenceOffset) {
  return {
    id: artifact.id,
    kind: "artifact",
    text: artifact.title,
    previewText: artifact.summaryText ?? artifact.title,
    sequence: sourceItem.sequence === null || sourceItem.sequence === void 0 ? null : sourceItem.sequence + sequenceOffset,
    sourceTurnId: artifact.sourceTurnId ?? null,
    artifact
  };
}
function maybeParseArtifactPayload(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value;
  const type = record.type === "remote-codex.artifact" ? record.artifactType : record.artifactType ?? record.type;
  if (typeof type !== "string" || !type.trim()) {
    return null;
  }
  return {
    artifactType: type,
    title: typeof record.title === "string" ? record.title : null,
    summaryText: typeof record.summaryText === "string" ? record.summaryText : null,
    payload: record.payload ?? record
  };
}
function findFencedBlocks(text, languages) {
  const blocks = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const opener = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opener) {
      continue;
    }
    const marker = opener[1] ?? "";
    const markerChar = marker[0] ?? "`";
    const markerLength = marker.length;
    const language = (opener[2] ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const contentLines = [];
    index += 1;
    while (index < lines.length) {
      const closeLine = lines[index] ?? "";
      const closePattern = new RegExp(`^ {0,3}\\${markerChar}{${markerLength},}\\s*$`);
      if (closePattern.test(closeLine)) {
        break;
      }
      contentLines.push(closeLine);
      index += 1;
    }
    if (languages.has(language)) {
      blocks.push({
        language,
        content: contentLines.join("\n").trim()
      });
    }
  }
  return blocks;
}
function readBalancedJsonFragment(text, startIndex) {
  const opener = text[startIndex];
  const expectedClose = opener === "{" ? "}" : opener === "[" ? "]" : null;
  if (!expectedClose) {
    return null;
  }
  const stack = [expectedClose];
  let inString = false;
  let escaping = false;
  for (let index = startIndex + 1; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      stack.push("}");
      continue;
    }
    if (char === "[") {
      stack.push("]");
      continue;
    }
    if (char === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }
  return null;
}
function containsArtifactFence(text) {
  return text.includes("```artifact") || text.includes("```remote-codex-artifact") || text.includes("~~~artifact") || text.includes("~~~remote-codex-artifact");
}
function collectArtifactCandidateStrings(value, output, budget, depth = 0) {
  if (output.length >= 20 || depth > 12 || budget.nodes <= 0) {
    return;
  }
  budget.nodes -= 1;
  if (typeof value === "string") {
    if (containsArtifactFence(value)) {
      output.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectArtifactCandidateStrings(entry, output, budget, depth + 1);
      if (output.length >= 20 || budget.nodes <= 0) {
        break;
      }
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectArtifactCandidateStrings(entry, output, budget, depth + 1);
      if (output.length >= 20 || budget.nodes <= 0) {
        break;
      }
    }
  }
}
function parseJsonArtifactCandidateStrings(fragment, output) {
  try {
    collectArtifactCandidateStrings(JSON.parse(fragment), output, { nodes: 2e3 });
  } catch {
  }
}
function findJsonFragmentAt(text, index) {
  let startIndex = index;
  while (startIndex < text.length && /\s/.test(text[startIndex] ?? "")) {
    startIndex += 1;
  }
  const char = text[startIndex];
  if (char !== "{" && char !== "[") {
    return null;
  }
  return readBalancedJsonFragment(text, startIndex);
}
function extractToolJsonArtifactCandidateStrings(text) {
  const values = [];
  const seenFragments = /* @__PURE__ */ new Set();
  const addFragment = (fragment) => {
    if (!fragment || seenFragments.has(fragment)) {
      return;
    }
    seenFragments.add(fragment);
    parseJsonArtifactCandidateStrings(fragment, values);
  };
  addFragment(findJsonFragmentAt(text, 0));
  const labelPattern = /(?:^|\n)(?:Arguments|Result)\n/g;
  for (const match of text.matchAll(labelPattern)) {
    addFragment(findJsonFragmentAt(text, match.index + match[0].length));
    if (seenFragments.size >= 4 || values.length >= 20) {
      break;
    }
  }
  return values;
}
function extractArtifactCandidateTexts(item, text) {
  const values = [text];
  if (item.kind !== "toolCall" || ![item.text, item.previewText, text].some(
    (value) => typeof value === "string" && value.includes(pockymoeMoleculeMcpToolName)
  )) {
    return values;
  }
  const seen = new Set(values);
  for (const value of extractToolJsonArtifactCandidateStrings(text)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }
  return values;
}
function isFiniteNumberToken(value) {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}
function looksLikeXyzMolecule(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const atomCount = Number(lines[0]);
  if (!Number.isInteger(atomCount) || atomCount <= 0 || atomCount > 1e5) {
    return false;
  }
  const atomLines = lines.slice(2);
  if (atomLines.length < atomCount) {
    return false;
  }
  return atomLines.slice(0, atomCount).every((line) => {
    const parts = line.split(/\s+/);
    return parts.length >= 4 && /^([A-Za-z][A-Za-z]?|\d+)$/.test(parts[0] ?? "") && isFiniteNumberToken(parts[1]) && isFiniteNumberToken(parts[2]) && isFiniteNumberToken(parts[3]);
  });
}
function looksLikePdbMolecule(content) {
  return content.split(/\r?\n/).some((line) => /^(ATOM|HETATM)\s+/i.test(line));
}
function looksLikeCifMolecule(content) {
  return /\bdata_[^\s]*/i.test(content) && /_atom_site\./i.test(content);
}
function looksLikeMoleculeStructure(content, format) {
  switch (format) {
    case "xyz":
    case "extxyz":
      return looksLikeXyzMolecule(content);
    case "pdb":
      return looksLikePdbMolecule(content);
    case "cif":
      return looksLikeCifMolecule(content);
    default:
      return false;
  }
}
var ManifestArtifactExtractor = class {
  constructor(manifests) {
    this.manifests = manifests;
  }
  manifests;
  extractFromTurn(turn, context) {
    const results = [];
    for (const item of turn.items) {
      const artifacts = this.extractFromItem(turn, item, context);
      if (artifacts.length > 0) {
        results.push({ sourceItem: item, artifacts });
      }
    }
    return results;
  }
  extractFromItem(turn, item, context) {
    const extractableText = [item.text, item.detailText ?? ""].map((entry) => entry.trim()).filter(Boolean).join("\n\n");
    if (item.kind === "artifact" || !extractableText) {
      return [];
    }
    const artifacts = [];
    artifacts.push(...this.extractJsonArtifacts(turn, item, context, extractableText));
    return artifacts;
  }
  extractJsonArtifacts(turn, item, context, text) {
    const artifacts = [];
    const extractableTexts = extractArtifactCandidateTexts(item, text);
    const seenBlocks = /* @__PURE__ */ new Set();
    for (const extractableText of extractableTexts) {
      for (const block of findFencedBlocks(extractableText, artifactFenceLanguages)) {
        const blockKey = `${block.language}
${block.content}`;
        if (seenBlocks.has(blockKey)) {
          continue;
        }
        seenBlocks.add(blockKey);
        if (!block.content) {
          continue;
        }
        let parsed;
        try {
          parsed = JSON.parse(block.content);
        } catch {
          continue;
        }
        const payload = maybeParseArtifactPayload(parsed);
        if (!payload || !this.hasArtifactType(payload.artifactType)) {
          continue;
        }
        artifacts.push({
          id: stableArtifactId({
            turnId: turn.id,
            itemId: item.id,
            pluginId: this.pluginIdForArtifactType(payload.artifactType) ?? "unknown",
            artifactType: payload.artifactType,
            index: artifacts.length
          }),
          pluginId: this.pluginIdForArtifactType(payload.artifactType) ?? "unknown",
          type: payload.artifactType,
          title: payload.title ?? "Plugin artifact",
          summaryText: payload.summaryText ?? null,
          payload: payload.payload,
          sourceTurnId: turn.id,
          sourceItemId: item.id,
          createdAt: context.now
        });
      }
    }
    return artifacts;
  }
  hasArtifactType(artifactType) {
    return this.pluginIdForArtifactType(artifactType) !== null;
  }
  pluginIdForArtifactType(artifactType) {
    for (const manifest of this.manifests) {
      if (manifest.capabilities.artifactTypes.some(
        (entry) => entry.type === artifactType
      )) {
        return manifest.id;
      }
    }
    return null;
  }
};
function appendArtifactItemsToTurns(turns, extractor, context) {
  return turns.map((turn) => {
    const extractionResults = extractor.extractFromTurn(turn, context);
    if (extractionResults.length === 0) {
      return turn;
    }
    const artifactItemsBySourceItemId = /* @__PURE__ */ new Map();
    for (const result of extractionResults) {
      artifactItemsBySourceItemId.set(
        result.sourceItem.id,
        result.artifacts.map(
          (artifact, index) => artifactItemFromArtifact(artifact, result.sourceItem, (index + 1) / 100)
        )
      );
    }
    const items = [];
    const existingIds = new Set(turn.items.map((item) => item.id));
    for (const item of turn.items) {
      items.push(item);
      const artifactItems = artifactItemsBySourceItemId.get(item.id) ?? [];
      for (const artifactItem of artifactItems) {
        if (!existingIds.has(artifactItem.id)) {
          items.push(artifactItem);
          existingIds.add(artifactItem.id);
        }
      }
    }
    return {
      ...turn,
      items
    };
  });
}

// src/manifest.ts
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function assertString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Plugin manifest field "${field}" must be a non-empty string.`);
  }
  return value.trim();
}
function optionalStringArray(value, field) {
  if (value === void 0) {
    return void 0;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Plugin manifest field "${field}" must be an array of strings.`);
  }
  return value;
}
function optionalStringRecord(value, field) {
  if (value === void 0) {
    return void 0;
  }
  if (!isRecord(value)) {
    throw new Error(`Plugin manifest field "${field}" must be an object.`);
  }
  const entries = Object.entries(value);
  if (entries.some(([, entry]) => typeof entry !== "string")) {
    throw new Error(`Plugin manifest field "${field}" must contain string values.`);
  }
  return Object.fromEntries(entries);
}
function parsePluginManifest(value) {
  if (!isRecord(value)) {
    throw new Error("Plugin manifest must be an object.");
  }
  const capabilities = value.capabilities;
  if (!isRecord(capabilities)) {
    throw new Error('Plugin manifest field "capabilities" must be an object.');
  }
  const artifactTypes = capabilities.artifactTypes;
  if (!Array.isArray(artifactTypes)) {
    throw new Error('Plugin manifest field "capabilities.artifactTypes" must be an array.');
  }
  const timelineRenderers = optionalStringArray(
    capabilities.timelineRenderers,
    "capabilities.timelineRenderers"
  ) ?? [];
  const threadPanels = capabilities.threadPanels;
  if (threadPanels !== void 0 && !Array.isArray(threadPanels)) {
    throw new Error('Plugin manifest field "capabilities.threadPanels" must be an array.');
  }
  const frontend = capabilities.frontend;
  if (frontend !== void 0 && !isRecord(frontend)) {
    throw new Error('Plugin manifest field "capabilities.frontend" must be an object.');
  }
  const backend = capabilities.backend;
  if (backend !== void 0 && !isRecord(backend)) {
    throw new Error('Plugin manifest field "capabilities.backend" must be an object.');
  }
  const modelHints = capabilities.modelHints;
  if (modelHints !== void 0 && !Array.isArray(modelHints)) {
    throw new Error('Plugin manifest field "capabilities.modelHints" must be an array.');
  }
  const mcpServers = capabilities.mcpServers;
  if (mcpServers !== void 0 && !Array.isArray(mcpServers)) {
    throw new Error('Plugin manifest field "capabilities.mcpServers" must be an array.');
  }
  return {
    id: assertString(value.id, "id"),
    name: assertString(value.name, "name"),
    version: assertString(value.version, "version"),
    description: assertString(value.description, "description"),
    remoteCodex: assertString(value.remoteCodex, "remoteCodex"),
    capabilities: {
      artifactTypes: artifactTypes.map((entry, index) => {
        if (!isRecord(entry)) {
          throw new Error(
            `Plugin manifest field "capabilities.artifactTypes[${index}]" must be an object.`
          );
        }
        const parsed = {
          type: assertString(entry.type, `capabilities.artifactTypes[${index}].type`),
          title: assertString(entry.title, `capabilities.artifactTypes[${index}].title`)
        };
        const fileExtensions = optionalStringArray(
          entry.fileExtensions,
          `capabilities.artifactTypes[${index}].fileExtensions`
        );
        return fileExtensions ? {
          ...parsed,
          fileExtensions
        } : parsed;
      }),
      timelineRenderers,
      threadPanels: (threadPanels ?? []).map((entry, index) => {
        if (!isRecord(entry)) {
          throw new Error(
            `Plugin manifest field "capabilities.threadPanels[${index}]" must be an object.`
          );
        }
        return {
          id: assertString(entry.id, `capabilities.threadPanels[${index}].id`),
          label: assertString(entry.label, `capabilities.threadPanels[${index}].label`),
          ...typeof entry.kind === "string" ? { kind: entry.kind } : {},
          artifactTypes: optionalStringArray(
            entry.artifactTypes,
            `capabilities.threadPanels[${index}].artifactTypes`
          ) ?? []
        };
      }),
      modelHints: (modelHints ?? []).map((entry, index) => {
        if (!isRecord(entry)) {
          throw new Error(
            `Plugin manifest field "capabilities.modelHints[${index}]" must be an object.`
          );
        }
        return {
          id: assertString(entry.id, `capabilities.modelHints[${index}].id`),
          text: assertString(entry.text, `capabilities.modelHints[${index}].text`)
        };
      }),
      mcpServers: (mcpServers ?? []).map((entry, index) => {
        if (!isRecord(entry)) {
          throw new Error(
            `Plugin manifest field "capabilities.mcpServers[${index}]" must be an object.`
          );
        }
        const args = optionalStringArray(
          entry.args,
          `capabilities.mcpServers[${index}].args`
        );
        const env = optionalStringRecord(
          entry.env,
          `capabilities.mcpServers[${index}].env`
        );
        return {
          id: assertString(entry.id, `capabilities.mcpServers[${index}].id`),
          name: assertString(entry.name, `capabilities.mcpServers[${index}].name`),
          command: assertString(entry.command, `capabilities.mcpServers[${index}].command`),
          ...args ? { args } : {},
          ...env ? { env } : {}
        };
      }),
      ...frontend ? {
        frontend: {
          ...typeof frontend.entry === "string" ? { entry: frontend.entry } : {},
          ...typeof frontend.style === "string" ? { style: frontend.style } : {}
        }
      } : {},
      ...backend ? {
        backend: {
          ...typeof backend.entry === "string" ? { entry: backend.entry } : {}
        }
      } : {}
    }
  };
}
export {
  ManifestArtifactExtractor,
  PluginRegistry,
  appendArtifactItemsToTurns,
  looksLikeCifMolecule,
  looksLikeMoleculeStructure,
  looksLikePdbMolecule,
  looksLikeXyzMolecule,
  parsePluginManifest
};
