import { useEffect, useRef, useState } from 'react';

import type { ComposerAttachmentDraft } from './composerUtils';

export type AttachmentPreviewMap = Record<string, string>;

function samePreviewUrls(current: AttachmentPreviewMap, next: AttachmentPreviewMap) {
  const keys = Object.keys(next);
  return keys.length === Object.keys(current).length &&
    keys.every((clientId) => current[clientId] === next[clientId]);
}

function revokeCachedPreviewUrls(previewUrlCache: Map<string, string>) {
  for (const previewUrl of previewUrlCache.values()) {
    URL.revokeObjectURL(previewUrl);
  }
  previewUrlCache.clear();
}

export function useAttachmentPreviewUrls({
  attachments,
  isShellView,
}: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  const previewUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] =
    useState<AttachmentPreviewMap>({});
  const shownPreviewUrlsRef = useRef(attachmentPreviewUrls);

  useEffect(() => {
    const previewUrlCache = previewUrlCacheRef.current;
    // Typing re-runs this effect with a new (often empty) attachments array.
    // Even a bailing-out setState counts towards React's nested-update limit,
    // so only set the map when its entries change (ELA-229).
    const showPreviewUrls = (next: AttachmentPreviewMap) => {
      if (samePreviewUrls(shownPreviewUrlsRef.current, next)) return;
      shownPreviewUrlsRef.current = next;
      setAttachmentPreviewUrls(next);
    };

    if (isShellView) {
      revokeCachedPreviewUrls(previewUrlCache);
      showPreviewUrls({});
      return;
    }

    const nextPreviewUrls: AttachmentPreviewMap = {};
    const activeClientIds = new Set<string>();

    for (const attachment of attachments) {
      if (attachment.kind !== 'photo') {
        continue;
      }

      activeClientIds.add(attachment.clientId);
      let previewUrl = previewUrlCache.get(attachment.clientId);
      if (!previewUrl) {
        previewUrl = URL.createObjectURL(attachment.file);
        previewUrlCache.set(attachment.clientId, previewUrl);
      }
      nextPreviewUrls[attachment.clientId] = previewUrl;
    }

    for (const [clientId, previewUrl] of previewUrlCache.entries()) {
      if (activeClientIds.has(clientId)) {
        continue;
      }
      URL.revokeObjectURL(previewUrl);
      previewUrlCache.delete(clientId);
    }

    showPreviewUrls(nextPreviewUrls);
  }, [attachments, isShellView]);

  useEffect(() => {
    const previewUrlCache = previewUrlCacheRef.current;
    return () => {
      revokeCachedPreviewUrls(previewUrlCache);
    };
  }, []);

  return attachmentPreviewUrls;
}
