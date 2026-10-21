import { getLocale } from '../i18n';
import { translate, useI18n } from '../i18n';
import type {
  ThreadDto,
  ThreadHistoryItemDto,
  ThreadTurnDto,
} from '@remote-codex/shared';

export function formatShortTimestamp(value: string | null) {
  if (!value) {
    return translate("chat.timeUnavailable");
  }

  return new Date(value).toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatLongTimestamp(value: string | null) {
  if (!value) {
    return translate("chat.timeUnavailable");
  }

  return new Date(value).toLocaleString(getLocale());
}

function formatMessageTime(value: string | null, precise: boolean) {
  if (!value) {
    return translate("chat.timeUnavailable");
  }

  const date = new Date(value);
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...(precise ? { second: '2-digit' } : {}),
  };
  if (isToday) {
    return date.toLocaleTimeString(getLocale(), options);
  }
  return date.toLocaleString(getLocale(), {
    ...options,
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatMessageTimestamp(value: string | null) {
  return formatMessageTime(value, false);
}

export function formatPreciseMessageTimestamp(value: string | null) {
  return formatMessageTime(value, true);
}

export function threadStatusLabel(status: ThreadDto['status']) {
  switch (status) {
    case 'recovering':
      return translate("chat.confirmingStatus");
    case 'idle':
      return translate("chat.idle");
    case 'running':
      return translate("chat.running");
    case 'interrupted':
      return translate("chat.interrupted");
    case 'failed':
      return translate("chat.failed");
    case 'not_loaded':
      return translate('chat.notLoaded');
    case 'system_error':
      return translate('chat.systemError');
  }
}

export function threadStatusClassName(status: ThreadDto['status']) {
  switch (status) {
    case 'idle':
      return 'ui-status-neutral';
    case 'running':
      return 'ui-status-info';
    case 'recovering':
    case 'interrupted':
      return 'ui-status-warning';
    case 'failed':
    case 'system_error':
      return 'ui-status-danger';
    case 'not_loaded':
      return 'ui-status-neutral';
  }
}

export function turnStatusLabel(status: ThreadTurnDto['status'] | 'sending') {
  switch (status) {
    case 'recovering':
      return translate("chat.confirmingStatus");
    case 'sending':
      return translate('chat.sendingStatus');
    case 'completed':
      return translate("chat.completed");
    case 'interrupted':
      return translate("chat.interrupted");
    case 'failed':
      return translate("chat.failed");
    case 'inProgress':
      return translate("chat.running");
  }
}

export function turnStatusClassName(
  status: ThreadTurnDto['status'] | 'sending',
) {
  switch (status) {
    case 'sending':
      return 'ui-status-info';
    case 'completed':
      return 'ui-status-success';
    case 'interrupted':
      return 'ui-status-warning';
    case 'failed':
      return 'ui-status-danger';
    case 'inProgress':
      return 'ui-status-info';
  }
}

export function historyItemAccentClassName(kind: ThreadHistoryItemDto['kind']) {
  switch (kind) {
    case 'userMessage':
      return 'timeline-kind-user';
    case 'agentMessage':
      return 'timeline-kind-agent';
    case 'artifact':
      return 'timeline-kind-action';
    case 'image':
      return 'timeline-kind-action';
    case 'contextCompaction':
      return 'timeline-kind-action';
    case 'commandExecution':
      return 'timeline-kind-command';
    case 'webSearch':
      return 'timeline-kind-search';
    case 'fileRead':
      return 'timeline-kind-file-read';
    case 'reasoning':
      return 'timeline-kind-reasoning';
    case 'agentToolCall':
      return 'timeline-kind-agent-tool';
    case 'skillToolCall':
      return 'timeline-kind-skill-tool';
    case 'toolCall':
      return 'timeline-kind-action';
    case 'plan':
      return 'timeline-kind-plan';
    case 'fileChange':
      return 'timeline-kind-file';
    case 'hook':
      return 'timeline-kind-action';
    case 'other':
      return 'ui-status-neutral';
  }
}

export function historyItemLabel(kind: ThreadHistoryItemDto['kind']) {
  switch (kind) {
    case 'userMessage':
      return translate("chat.user");
    case 'agentMessage':
      return translate("chat.agent");
    case 'artifact':
      return translate("chat.artifact_aa778b");
    case 'image':
      return translate("chat.image");
    case 'contextCompaction':
      return translate("chat.context");
    case 'commandExecution':
      return translate("chat.command");
    case 'webSearch':
      return translate("chat.webSearch_9f1a43");
    case 'fileRead':
      return translate("chat.fileRead_2986bc");
    case 'reasoning':
      return translate("chat.reasoning");
    case 'agentToolCall':
      return translate("chat.agent");
    case 'skillToolCall':
      return translate("chat.skill");
    case 'toolCall':
      return translate("chat.tool");
    case 'plan':
      return translate("chat.plan");
    case 'fileChange':
      return translate("chat.fileChange_cf4620");
    case 'hook':
      return translate("chat.hook");
    case 'other':
      return translate("chat.other");
  }
}

export function isScrollableHistoryItem(kind: ThreadHistoryItemDto['kind']) {
  return kind === 'commandExecution' || kind === 'reasoning';
}
