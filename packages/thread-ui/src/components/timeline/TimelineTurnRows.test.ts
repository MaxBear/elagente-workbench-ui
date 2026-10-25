import { describe, expect, it } from 'vitest';
import type { ThreadHistoryItemDto } from '@remote-codex/shared';

import { formatWorkedDuration, latestActivityTimestamp } from './TimelineTurnRows';

function tool(overrides: Partial<ThreadHistoryItemDto> = {}): ThreadHistoryItemDto {
  return { id: 'tool', kind: 'toolCall', text: 'run', ...overrides };
}

// ELA-253 UI (b): "Last progress" must move when a tool finishes, not only when one starts.
describe('turn activity timestamps', () => {
  it('advances to a tool item update after its creation', () => {
    const items = [
      tool({ createdAt: '2026-10-25T10:00:05.000Z', updatedAt: '2026-10-25T10:03:00.000Z', status: 'completed' }),
    ];
    expect(latestActivityTimestamp('2026-10-25T10:00:00.000Z', items, null)).toBe('2026-10-25T10:03:00.000Z');
  });

  it('uses the item update even without a creation time', () => {
    expect(latestActivityTimestamp('2026-10-25T10:00:00.000Z', [tool({ updatedAt: '2026-10-25T10:01:00.000Z' })], null))
      .toBe('2026-10-25T10:01:00.000Z');
  });

  it('keeps the creation time when an update is older or invalid', () => {
    const items = [tool({ createdAt: '2026-10-25T10:02:00.000Z', updatedAt: 'not a time' })];
    expect(latestActivityTimestamp('2026-10-25T10:00:00.000Z', items, null)).toBe('2026-10-25T10:02:00.000Z');
  });

  it('still takes newer live activity from the host', () => {
    const items = [tool({ createdAt: '2026-10-25T10:00:05.000Z', updatedAt: '2026-10-25T10:01:00.000Z' })];
    expect(latestActivityTimestamp('2026-10-25T10:00:00.000Z', items, '2026-10-25T10:05:00.000Z'))
      .toBe('2026-10-25T10:05:00.000Z');
  });

  it('counts a tool completion in the worked duration of a turn without an end time', () => {
    const items = [tool({ createdAt: '2026-10-25T10:00:05.000Z', updatedAt: '2026-10-25T10:02:00.000Z' })];
    expect(formatWorkedDuration('2026-10-25T10:00:00.000Z', null, items)).toBe(
      formatWorkedDuration('2026-10-25T10:00:00.000Z', '2026-10-25T10:02:00.000Z', []),
    );
  });
});
