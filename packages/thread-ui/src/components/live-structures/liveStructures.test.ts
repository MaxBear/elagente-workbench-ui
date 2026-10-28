import { describe, expect, it } from 'vitest';
import {
  deriveLiveStructureColumns,
  liveStructureCell,
  liveStructureKey,
  liveStructurePageCount,
  toggleLiveStructure,
  type LiveStructureRow,
} from './liveStructures';

const row = (id: string, summary: LiveStructureRow['summary'] = {}, producer = 'pyscf/batch-1'): LiveStructureRow => ({ producer, id, status: 'running', summary });

describe('live structure columns', () => {
  it('orders id, the known summary keys, other keys, then status and folds the unit into energy', () => {
    const columns = deriveLiveStructureColumns([
      row('a', { energy: -76.4, unit: 'Eh', step: 4, zeta: 'x' }),
      row('b', { label: 'H2O', stage: 'relax', alpha: 1, step: 5 }),
    ]);
    expect(columns.map(column => column.key)).toEqual(['id', 'label', 'stage', 'step', 'energy', 'alpha', 'zeta', 'status']);
    expect(columns.find(column => column.key === 'step')?.numeric).toBe(true);
    expect(columns.find(column => column.key === 'stage')?.numeric).toBe(false);
  });
  it('keeps a unit column when no energy is reported and always shows id and status', () => {
    expect(deriveLiveStructureColumns([row('a', { unit: 'eV' })]).map(column => column.key)).toEqual(['id', 'unit', 'status']);
    expect(deriveLiveStructureColumns([]).map(column => column.key)).toEqual(['id', 'status']);
  });
  it('formats energy with its unit and leaves missing values empty', () => {
    expect(liveStructureCell(row('a', { energy: -76.41, unit: 'Eh' }), 'energy')).toBe(`${(-76.41).toLocaleString()} Eh`);
    expect(liveStructureCell(row('a', { energy: null }), 'energy')).toBe('');
    expect(liveStructureCell(row('a', { done: true }), 'done')).toBe('yes');
    expect(liveStructureCell(row('a'), 'id')).toBe('a');
  });
});

describe('live structure selection', () => {
  it('toggles by producer and id within the limit', () => {
    const a = { producer: 'p', id: 'a' }, b = { producer: 'q', id: 'a' };
    expect(toggleLiveStructure([], a)).toEqual([a]);
    expect(toggleLiveStructure([a], b)).toEqual([a, b]);
    expect(toggleLiveStructure([a, b], a)).toEqual([b]);
    expect(toggleLiveStructure([a], b, 1)).toEqual([a]);
    expect(liveStructureKey(a)).not.toBe(liveStructureKey(b));
  });
  it('always has at least one page', () => {
    expect(liveStructurePageCount(0)).toBe(1);
    expect(liveStructurePageCount(10_000, 100)).toBe(100);
    expect(liveStructurePageCount(10_001, 100)).toBe(101);
  });
});
