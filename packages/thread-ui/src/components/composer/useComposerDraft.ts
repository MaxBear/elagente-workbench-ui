import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { PromptAttachmentUpload } from '../../types';
import {
  draftSignature,
  type ComposerAttachmentDraft,
  type ComposerDraft,
} from './composerUtils';

export type DraftSyncMode = 'deferred' | 'immediate';

export const DRAFT_SYNC_DELAY_MS = 180;

type DraftHostState = {
  prompt: string;
  attachments: PromptAttachmentUpload[];
};

type DraftUpdater = (current: ComposerDraft) => ComposerDraft;

export interface UseComposerDraftInput {
  isShellView: boolean;
  draftPrompt?: string | undefined;
  draftAttachments?: PromptAttachmentUpload[] | undefined;
  onDraftChange?:
    | Dispatch<SetStateAction<DraftHostState>>
    | undefined;
}

export interface UseComposerDraftResult {
  prompt: string;
  attachments: ComposerAttachmentDraft[];
  isDraftControlled: boolean;
  updateDraft: (updater: DraftUpdater, syncMode?: DraftSyncMode) => void;
  flushControlledDraftToHost: (nextDraft?: ComposerDraft) => void;
  captureSubmission: (snapshot: ComposerDraft) => { complete: () => void; cancel: () => void };
}

function toComposerDraft(
  prompt: string | undefined,
  attachments: PromptAttachmentUpload[] | undefined,
): ComposerDraft {
  return {
    prompt: prompt ?? '',
    attachments: (attachments ?? []) as ComposerAttachmentDraft[],
  };
}

export function useComposerDraft({
  isShellView,
  draftPrompt,
  draftAttachments,
  onDraftChange,
}: UseComposerDraftInput): UseComposerDraftResult {
  const [internalDraft, setInternalDraft] = useState<ComposerDraft>({
    prompt: '',
    attachments: [],
  });
  const [localControlledDraft, setLocalControlledDraft] =
    useState<ComposerDraft>(() => toComposerDraft(draftPrompt, draftAttachments));
  const submittedClearRef = useRef<{ signature: string } | null>(null);
  const draftSyncTimerRef = useRef<number | null>(null);
  const latestLocalDraftRef = useRef<ComposerDraft>(localControlledDraft);
  const lastSentDraftSignatureRef = useRef(draftSignature(localControlledDraft));
  const pendingHostEchoesRef = useRef(new Set<string>());
  const isDraftControlled =
    !isShellView &&
    draftPrompt !== undefined &&
    draftAttachments !== undefined &&
    typeof onDraftChange === 'function';
  const controlledPropsSignature = isDraftControlled
    ? draftSignature(toComposerDraft(draftPrompt, draftAttachments))
    : '';
  const lastRenderedControlledPropsSignatureRef = useRef(
    controlledPropsSignature,
  );

  useLayoutEffect(() => {
    if (!isDraftControlled) {
      lastRenderedControlledPropsSignatureRef.current = '';
      pendingHostEchoesRef.current.clear();
      return;
    }

    const hostDraft = toComposerDraft(draftPrompt, draftAttachments);
    const hostSignature = draftSignature(hostDraft);

    if (hostSignature === lastRenderedControlledPropsSignatureRef.current) {
      return;
    }

    lastRenderedControlledPropsSignatureRef.current = hostSignature;
    // Some hosts clear their controlled draft when an HTTP send is accepted.
    // That acknowledgement belongs to the submitted snapshot, not text/File
    // objects added while the request was in flight.
    if (!hostDraft.prompt && hostDraft.attachments.length === 0 && submittedClearRef.current) {
      const submitted = submittedClearRef.current;
      submittedClearRef.current = null;
      const local = latestLocalDraftRef.current;
      const localSignature = draftSignature(local);
      if ((local.prompt || local.attachments.length > 0) && localSignature !== submitted.signature) {
        lastSentDraftSignatureRef.current = localSignature;
        pendingHostEchoesRef.current.add(localSignature);
        onDraftChange?.(() => ({ prompt: local.prompt, attachments: local.attachments as PromptAttachmentUpload[] }));
        return;
      }
    }
    // Host acknowledgements may arrive after the next dictation/typing update.
    // They acknowledge persistence; they must not roll back newer local text.
    if (pendingHostEchoesRef.current.delete(hostSignature)) return;
    pendingHostEchoesRef.current.clear();
    lastSentDraftSignatureRef.current = hostSignature;
    latestLocalDraftRef.current = hostDraft;
    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }
    setLocalControlledDraft(hostDraft);
  }, [draftAttachments, draftPrompt, isDraftControlled, onDraftChange]);

  const sendDraftToHost = useCallback((nextDraft: ComposerDraft) => {
    if (!isDraftControlled || !onDraftChange) {
      return;
    }

    const signature = draftSignature(nextDraft);
    if (signature === lastSentDraftSignatureRef.current) {
      return;
    }

    lastSentDraftSignatureRef.current = signature;
    pendingHostEchoesRef.current.add(signature);
    if (pendingHostEchoesRef.current.size > 32) {
      pendingHostEchoesRef.current.delete(pendingHostEchoesRef.current.values().next().value!);
    }
    onDraftChange(() => ({
      prompt: nextDraft.prompt,
      attachments: nextDraft.attachments as PromptAttachmentUpload[],
    }));
  }, [isDraftControlled, onDraftChange]);

  useEffect(() => {
    return () => {
      sendDraftToHost(latestLocalDraftRef.current);
      if (draftSyncTimerRef.current !== null) {
        window.clearTimeout(draftSyncTimerRef.current);
      }
    };
  }, [sendDraftToHost]);

  const syncControlledDraftToHost = useCallback((
    nextDraft: ComposerDraft,
    mode: DraftSyncMode,
  ) => {
    if (!isDraftControlled) {
      return;
    }

    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }

    if (mode === 'immediate') {
      sendDraftToHost(nextDraft);
      return;
    }

    draftSyncTimerRef.current = window.setTimeout(() => {
      draftSyncTimerRef.current = null;
      sendDraftToHost(latestLocalDraftRef.current);
    }, DRAFT_SYNC_DELAY_MS);
  }, [isDraftControlled, sendDraftToHost]);

  const flushControlledDraftToHost = useCallback(
    (nextDraft = latestLocalDraftRef.current) => {
      syncControlledDraftToHost(nextDraft, 'immediate');
    },
    [syncControlledDraftToHost],
  );

  const updateDraft = useCallback((
    updater: DraftUpdater,
    syncMode: DraftSyncMode = 'immediate',
  ) => {
    if (isDraftControlled) {
      const nextDraft = updater(latestLocalDraftRef.current);
      latestLocalDraftRef.current = nextDraft;
      setLocalControlledDraft(nextDraft);
      syncControlledDraftToHost(nextDraft, syncMode);
      return;
    }

    setInternalDraft((current) => updater(current));
  }, [isDraftControlled, syncControlledDraftToHost]);

  const captureSubmission = useCallback((snapshot: ComposerDraft) => {
    const token = { signature: draftSignature(snapshot) };
    submittedClearRef.current = token;
    return {
      complete: () => updateDraft(current => draftSignature(current) === token.signature
        ? { prompt: '', attachments: [] } : current),
      cancel: () => { if (submittedClearRef.current === token) submittedClearRef.current = null; },
    };
  }, [updateDraft]);

  const currentDraft = isDraftControlled ? localControlledDraft : internalDraft;

  return {
    prompt: currentDraft.prompt,
    attachments: currentDraft.attachments,
    isDraftControlled,
    updateDraft,
    flushControlledDraftToHost,
    captureSubmission,
  };
}
