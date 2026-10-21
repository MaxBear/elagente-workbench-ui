import { translate, useI18n } from '../../i18n';
import {
  useCallback,
  useState,
  type RefObject,
} from 'react';

import type {
  ThreadGoalDto,
  ThreadGoalStatusDto,
} from '@remote-codex/shared';
import {
  formatGoalTokenBudgetThousands,
  parseGoalTokenBudgetThousands,
  type ComposerDraft,
} from './composerUtils';

interface UseComposerGoalInput {
  prompt: string;
  goalTokenBudgetSource: ThreadGoalDto | null | undefined;
  promptRef: RefObject<HTMLElement | null>;
  onOpenGoal?: () => Promise<void> | void;
  onPrepareGoalSubmit?: (input: {
    objective: string;
    tokenBudget: number | null;
  }) => Promise<boolean | void> | boolean | void;
  onUpdateGoal?: (input: {
    objective?: string | null;
    status?: ThreadGoalStatusDto | null;
    tokenBudget?: number | null;
  }) => Promise<void> | void;
  updateDraft: (updater: (current: ComposerDraft) => ComposerDraft) => void;
  closeMenu: () => void;
  resetSlashPanel: () => void;
}

export interface UseComposerGoalResult {
  goalComposeMode: boolean;
  goalTokenBudget: string;
  goalBusy: boolean;
  goalLocalError: string | null;
  setGoalTokenBudget: (value: string) => void;
  submitGoal: () => Promise<boolean>;
  enterGoalComposeMode: () => void;
  exitGoalComposeMode: () => void;
}

export function useComposerGoal({
  prompt,
  goalTokenBudgetSource,
  promptRef,
  onOpenGoal,
  onPrepareGoalSubmit,
  onUpdateGoal,
  updateDraft,
  closeMenu,
  resetSlashPanel,
}: UseComposerGoalInput): UseComposerGoalResult {
  useI18n();
  const [goalComposeMode, setGoalComposeMode] = useState(false);
  const [goalTokenBudget, setGoalTokenBudget] = useState('');
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalLocalError, setGoalLocalError] = useState<string | null>(null);

  const submitGoal = useCallback(async () => {
    const objective = prompt.trim();
    if (!objective) {
      setGoalLocalError(translate("chat.goalObjectiveCannotBeEmpty"));
      return false;
    }

    const normalizedBudget = goalTokenBudget.trim();
    const tokenBudget = parseGoalTokenBudgetThousands(normalizedBudget);
    if (
      normalizedBudget.length > 0 &&
      (tokenBudget === null ||
        !Number.isInteger(tokenBudget) ||
        tokenBudget <= 0)
    ) {
      setGoalLocalError(translate("chat.tokenBudgetMustBeAPositiveNumber"));
      return false;
    }

    if (!onUpdateGoal) {
      setGoalLocalError(translate("chat.goalIsUnavailableInThisView"));
      return false;
    }

    setGoalBusy(true);
    setGoalLocalError(null);
    try {
      if (onPrepareGoalSubmit) {
        const prepared = await onPrepareGoalSubmit({
          objective,
          tokenBudget,
        });
        if (prepared === false) {
          return false;
        }
      }
      await onUpdateGoal({
        objective,
        status: 'active',
        tokenBudget,
      });
      setGoalTokenBudget('');
      setGoalComposeMode(false);
      updateDraft(() => ({
        prompt: '',
        attachments: [],
      }));
      return true;
    } catch (error) {
      setGoalLocalError(
        error instanceof Error ? error.message : translate("chat.unableToSetGoal"),
      );
      return false;
    } finally {
      setGoalBusy(false);
    }
  }, [goalTokenBudget, onPrepareGoalSubmit, onUpdateGoal, prompt, updateDraft]);

  const enterGoalComposeMode = useCallback(() => {
    closeMenu();
    resetSlashPanel();
    setGoalComposeMode(true);
    setGoalTokenBudget(
      formatGoalTokenBudgetThousands(goalTokenBudgetSource?.tokenBudget),
    );
    setGoalLocalError(null);
    void onOpenGoal?.();
    requestAnimationFrame(() => {
      promptRef.current?.focus();
    });
  }, [
    closeMenu,
    goalTokenBudgetSource?.tokenBudget,
    onOpenGoal,
    promptRef,
    resetSlashPanel,
  ]);

  const exitGoalComposeMode = useCallback(() => {
    setGoalComposeMode(false);
    setGoalLocalError(null);
  }, []);

  return {
    goalComposeMode,
    goalTokenBudget,
    goalBusy,
    goalLocalError,
    setGoalTokenBudget,
    submitGoal,
    enterGoalComposeMode,
    exitGoalComposeMode,
  };
}
