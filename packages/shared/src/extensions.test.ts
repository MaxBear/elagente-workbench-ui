import { describe, expect, it } from 'vitest';

import { createHash } from 'node:crypto';

import { EXTENSION_FIXTURES, FRAME_CELL_FIXTURE } from './extension-fixtures.mjs';
import { validateArtifactMetadata } from './extensions.mjs';

const base = EXTENSION_FIXTURES.grafico.artifacts[0]!.metadata;
const cubic = (a: number) => ({
  vectors: [
    [a, 0, 0],
    [0, a, 0],
    [0, 0, a],
  ],
  periodic: [true, true, true],
  unit: 'angstrom',
});
const targets = (count: number) =>
  Array.from({ length: count }, (_, frameIndex) => ({
    artifactId: 'art-1',
    objectId: base.objectId,
    sourceRevision: base.sourceRevision,
    checksum: base.checksum,
    streamId: base.stream!.id,
    frameId: `frame-${frameIndex}`,
    frameIndex,
  }));
const without = (value: object, ...keys: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
const multiFrame = (frameCells: unknown, frameCount = 3) => ({
  ...without(base, 'cell'),
  frameTargets: targets(frameCount),
  frameCells,
});
const rejects = (value: unknown, path: string) =>
  expect(() => validateArtifactMetadata(value)).toThrow(
    expect.objectContaining({ path }),
  );

describe('frameCells metadata contract', () => {
  it('keeps single-cell metadata valid', () => {
    expect(base.cell).toBeDefined();
    expect(validateArtifactMetadata(structuredClone(base))).toBeTruthy();
  });

  it('accepts one cell or null per frame target', () => {
    const value = multiFrame([cubic(10), null, cubic(10.5)]);
    expect(validateArtifactMetadata(value)).toBe(value);
  });

  it('accepts the shared frame-cell fixture', () => {
    const { artifact } = FRAME_CELL_FIXTURE;
    expect(validateArtifactMetadata(structuredClone(artifact.metadata))).toBeTruthy();
    expect(createHash('sha256').update(artifact.fixtureBytes).digest('hex')).toBe(artifact.checksum);
    expect(Buffer.byteLength(artifact.fixtureBytes)).toBe(artifact.size);
  });

  it('requires frame targets, not just a stream', () => {
    rejects({ ...without(base, 'cell'), frameCells: [cubic(9)] }, 'frameCells');
  });

  it('rejects cell and frameCells together', () => {
    rejects({ ...multiFrame([cubic(9), cubic(10), cubic(11)]), cell: cubic(9) }, 'frameCells');
  });

  it('rejects frame cells on single-frame metadata', () => {
    rejects(
      { ...without(base, 'cell', 'stream'), frameCells: [cubic(9)] },
      'frameCells',
    );
  });

  it('requires exactly one entry per frame target', () => {
    rejects(multiFrame([cubic(9), cubic(10)]), 'frameCells');
    rejects(multiFrame([cubic(9), cubic(10), null, null]), 'frameCells');
  });

  it('requires an array', () => {
    rejects(multiFrame(cubic(9)), 'frameCells');
  });

  it('validates every entry exactly like cell', () => {
    rejects(multiFrame([cubic(9), cubic(0), null]), 'frameCells[1].vectors');
    rejects(
      multiFrame([cubic(9), null, { ...cubic(9), unit: 'nm' }]),
      'frameCells[2].unit',
    );
    rejects(
      multiFrame([{ ...cubic(9), periodic: [true, true] }, null, null]),
      'frameCells[0].periodic',
    );
    rejects(
      multiFrame([{ ...cubic(9), vectors: [[9, 0, 0], [0, 9, 0]] }, null, null]),
      'frameCells[0].vectors',
    );
    rejects(
      multiFrame([{ ...cubic(9), vectors: [[9, 0], [0, 9, 0], [0, 0, 9]] }, null, null]),
      'frameCells[0].vector',
    );
    rejects(multiFrame(['cell', null, null]), 'frameCells[0]');
    rejects(multiFrame([undefined, null, null]), 'data.frameCells[0]');
  });
});
