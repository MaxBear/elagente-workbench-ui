import type { ThreadSkillsDto } from '@remote-codex/shared';

import { ClipboardIcon, skillScopeLabel } from './composerPresentation';
import type { SlashPanelState } from './types';

interface ComposerSkillsPanelProps {
  skillsState: SlashPanelState<ThreadSkillsDto>;
  copiedSkillName: string | null;
  composerChipButtonClassName: string;
  onCopySkillInvokeName: (skillName: string) => Promise<void> | void;
}

export function ComposerSkillsPanel({
  skillsState,
  copiedSkillName,
  composerChipButtonClassName,
  onCopySkillInvokeName,
}: ComposerSkillsPanelProps) {
  return (
    <div className="p-2">
      {skillsState.status === 'loading' && !skillsState.data ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          Loading skills...
        </p>
      ) : null}
      {skillsState.error ? (
        <p className="mb-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm text-rose-100/90">
          {skillsState.error}
        </p>
      ) : null}
      {skillsState.data?.skills.length ? (
        <div className="space-y-2">
          {skillsState.data.skills.map((skill) => (
            <div
              key={skill.path}
              className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5"
            >
              <div className="space-y-2">
                <p className="truncate text-sm font-medium text-stone-100">
                  {skill.interface?.displayName ?? skill.name}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-stone-700 px-2 py-1 text-stone-400">
                    {skillScopeLabel(skill.scope)}
                  </span>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 normal-case tracking-normal transition ${
                      copiedSkillName === skill.name
                        ? 'border-sky-400/45 bg-sky-400/12 text-sky-100'
                        : `${composerChipButtonClassName} border-stone-700 text-stone-300 hover:border-stone-500`
                    }`}
                    onClick={() => void onCopySkillInvokeName(skill.name)}
                    title={`Copy $${skill.name}`}
                    aria-label={`Copy $${skill.name}`}
                  >
                    <ClipboardIcon />${skill.name}
                  </button>
                </div>
                <p className="text-xs leading-5 text-stone-400">
                  {skill.interface?.shortDescription ??
                    skill.shortDescription ??
                    skill.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {skillsState.data?.errors.length ? (
        <div className="mt-2 space-y-2">
          {skillsState.data.errors.map((entry) => (
            <div
              key={`${entry.path}:${entry.message}`}
              className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/85"
            >
              <p className="font-medium">{entry.message}</p>
              <p className="mt-1 break-all text-amber-100/60">
                {entry.path}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {skillsState.status !== 'loading' &&
      !skillsState.error &&
      (skillsState.data?.skills.length ?? 0) === 0 &&
      (skillsState.data?.errors.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-3 text-sm text-stone-400">
          No skills available right now.
        </p>
      ) : null}
    </div>
  );
}
