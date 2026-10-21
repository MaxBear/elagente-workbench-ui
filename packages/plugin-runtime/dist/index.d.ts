import { ThreadHistoryItemDto, ThreadArtifactDto, ThreadTurnDto, PluginManifestDto, PluginDto } from '@remote-codex/shared';

type PockymoePluginManifest = PluginManifestDto;
interface RegisteredPlugin {
    manifest: PockymoePluginManifest;
    enabledByDefault?: boolean;
    source?: 'builtin' | 'imported';
}
interface PluginRegistrySnapshot {
    plugins: PluginDto[];
}
interface ArtifactExtractionContext {
    threadId: string;
    workspacePath: string;
    now: string;
}
interface ArtifactExtractionResult {
    sourceItem: ThreadHistoryItemDto;
    artifacts: ThreadArtifactDto[];
}
interface ArtifactExtractor {
    extractFromTurn(turn: ThreadTurnDto, context: ArtifactExtractionContext): ArtifactExtractionResult[];
}

declare class PluginRegistry {
    private readonly plugins;
    private readonly enabled;
    constructor(plugins?: RegisteredPlugin[]);
    register(plugin: RegisteredPlugin): void;
    updateImported(plugin: RegisteredPlugin): void;
    list(): PluginDto[];
    get(pluginId: string): PluginDto | null;
    getManifest(pluginId: string): PluginManifestDto | null;
    getRegistered(pluginId: string): RegisteredPlugin | null;
    isEnabled(pluginId: string): boolean;
    setEnabled(pluginId: string, enabled: boolean): PluginDto;
    enabledManifests(): PluginManifestDto[];
    private toDto;
}

declare function looksLikeXyzMolecule(content: string): boolean;
declare function looksLikePdbMolecule(content: string): boolean;
declare function looksLikeCifMolecule(content: string): boolean;
declare function looksLikeMoleculeStructure(content: string, format: string): boolean;
declare class ManifestArtifactExtractor implements ArtifactExtractor {
    private readonly manifests;
    constructor(manifests: PluginManifestDto[]);
    extractFromTurn(turn: ThreadTurnDto, context: ArtifactExtractionContext): ArtifactExtractionResult[];
    private extractFromItem;
    private extractJsonArtifacts;
    private hasArtifactType;
    private pluginIdForArtifactType;
}
declare function appendArtifactItemsToTurns(turns: ThreadTurnDto[], extractor: ArtifactExtractor, context: ArtifactExtractionContext): ThreadTurnDto[];

declare function parsePluginManifest(value: unknown): PluginManifestDto;

export { type ArtifactExtractionContext, type ArtifactExtractionResult, type ArtifactExtractor, ManifestArtifactExtractor, PluginRegistry, type PluginRegistrySnapshot, type PockymoePluginManifest, type RegisteredPlugin, appendArtifactItemsToTurns, looksLikeCifMolecule, looksLikeMoleculeStructure, looksLikePdbMolecule, looksLikeXyzMolecule, parsePluginManifest };
