import { translate, useI18n } from '../../i18n';
import { type ReactNode } from 'react';
import {
  BarChart2,
  Code2,
  FileImage,
  FolderOpen,
  MessageSquare,
  MoveRight,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './GraphAccordion';

function GuideTag({ children }: { children: ReactNode }) {
  const { locale: i18nLocale } = useI18n();
  return (
    <span className="thread-guide-tag inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </span>
  );
}

function GuideBullets({ items }: { items: ReactNode[] }) {
  const { locale: i18nLocale } = useI18n();
  return (
    <ul className="space-y-1 text-[12px] text-[var(--theme-fg-muted)]">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[var(--theme-border-contrast)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  const { locale: i18nLocale } = useI18n();
  return (
    <span className="thread-guide-icon flex h-5 w-5 shrink-0 items-center justify-center rounded-md">
      {children}
    </span>
  );
}

function GuideAccordionItem({
  value,
  title,
  icon,
  children,
}: {
  value: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const { locale: i18nLocale } = useI18n();
  return (
    <AccordionItem
      value={value}
      className="thread-guide-section border-b border-[var(--theme-border)] last:border-b-0"
    >
      <AccordionTrigger className="py-3 hover:no-underline [&[data-state=open]]:pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-fg)]">
          <SectionIcon>{icon}</SectionIcon>
          {title}
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function GraphGuidePanel() {
  const { locale: i18nLocale } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--theme-border)] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-fg-muted)]">
          {translate("files.whatCanIDo")}</h2>
        <p className="mt-0.5 text-[11px] text-[var(--theme-fg-muted)]">
          {translate("files.uploadFilesAskInPlainLanguageGet")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <Accordion
          type="multiple"
          defaultValue={['start', 'workspace', 'pockymoe']}
          className="space-y-0"
        >
        <GuideAccordionItem
          value="start"
          title={translate("files.gettingStarted")}
          icon={<Zap className="h-3 w-3" />}
        >
          <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
            {translate("files.graphchatConnectsALanguageModelToYour")}</p>
          <GuideBullets
            items={[
              translate("files.uploadDataFilesViaTheWorkspacePanel"),
              translate("files.typeAQuestionOrTaskInPlain"),
              translate("files.theAgentCallsToolsWritesResultsTo"),
              translate("files.agentProducedFilesAppearInTheWorkspace"),
            ]}
          />
        </GuideAccordionItem>

        <GuideAccordionItem
          value="workspace"
          title={translate("files.workspaceExplorer")}
          icon={<FolderOpen className="h-3 w-3" />}
        >
          <div className="flex items-start gap-2">
            <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.upload")}</p>
              <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
                {translate("files.uploadFilesThroughTheWorkspacePanelWhen")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.newFilesAndFolders")}</p>
              <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
                {translate("files.pockymoeNormallyCreatesFilesThroughTools")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MoveRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.moveAndOrganize")}</p>
              <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
                {translate("files.useTheAgentOrTerminalToReorganize")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.garbageFolder")}</p>
              <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
                {translate("files.ifTheHostExposesGarbageControlsExplorer")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.refresh")}</p>
              <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
                {translate("files.resyncTheFileTreeManuallyAfterShell")}</p>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-fg-muted)]">
              {translate("files.previewSurfaces")}</p>
            <GuideBullets
              items={[
                <>
                  <GuideTag>.xyz .extxyz .cif</GuideTag> {translate("files.useThe3DMoleculePlugin")}</>,
                <>
                  <GuideTag>.png .jpg .gif .svg .webp</GuideTag> {translate("files.useInlineImagePreview")}</>,
                <>
                  <GuideTag>.py .json .ts .md .csv</GuideTag> {translate("files.useTextCodePreview")}</>,
                translate("files.largeFilesLoadInChunksWhenThe"),
              ]}
            />
          </div>
        </GuideAccordionItem>

        <GuideAccordionItem
          value="viewer"
          title={translate("files.viewer")}
          icon={<FileImage className="h-3 w-3" />}
        >
          <p className="text-[11px] leading-5 text-[var(--theme-fg-muted)]">
            {translate("files.viewerIsTheGraphChatStyleArtifactSurface")}</p>
          <GuideBullets
            items={[
              translate("files.expandOneArtifactAtATimeFor"),
              translate("files.fallbackJSONPreviewIsAvailableForUnknown"),
              translate("files.3DMoleculeArtifactsRemainInteractiveWhenThe"),
            ]}
          />
        </GuideAccordionItem>

        <GuideAccordionItem
          value="usage"
          title={translate("files.toolUsageChat")}
          icon={<BarChart2 className="h-3 w-3" />}
        >
          <div className="flex items-start gap-2">
            <BarChart2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.usageTab")}</p>
              <GuideBullets
                items={[
                  translate("files.barChartOfToolAndCommandCounts"),
                  translate("files.expandableCallLogInspectEveryInputAnd"),
                  translate("files.recentLiveEventsAppearWithPersistedHistory"),
                ]}
              />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" />
            <div>
              <p className="text-[11px] font-medium text-[var(--theme-fg)]">
                {translate("files.chatControls")}</p>
              <GuideBullets
                items={[
                  translate("files.newChatCreatesAFreshPockymoe"),
                  translate("files.interruptCompactGoalControlsAndModelControls"),
                  translate("files.shellViewStaysAvailableWhenAShell"),
                ]}
              />
            </div>
          </div>
        </GuideAccordionItem>

        <GuideAccordionItem
          value="pockymoe"
          title={translate("files.pockymoeExtras")}
          icon={<Code2 className="h-3 w-3" />}
        >
          <GuideBullets
            items={[
              translate("files.slashToolboxSkillsMCPHooksGoalsForks"),
              translate("files.richMessageBubblesReasoningCommandsSearchesFile"),
              translate("files.pluginSurfacesTerminalXYZMoleculeViewerInline"),
              translate("files.threadMetadataStaysInTheLeftRail"),
            ]}
          />
        </GuideAccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
