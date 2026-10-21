import { describe, expect, it } from 'vitest';

import { linkedDirectoryNodes, linkedParentDirectory } from './workspaceLinkedFiles';

describe('linked file directories', () => {
  it.each([
    ['/home/me/dev/other/docs/icon.png', '/home/me/dev/other/docs'],
    ['/icon.png', '/'],
    ['C:/Users/me/icon.png', 'C:/Users/me'],
    ['C:/icon.png', 'C:/'],
    ['//server/share/icon.png', '//server/share'],
  ])('uses the real parent of %s', (path, parent) => {
    expect(linkedParentDirectory(path)).toBe(parent);
  });

  it('groups files that share a parent and keeps other parents separate', () => {
    const file = (path: string) => ({ id: `workspace:${path}`, name: path.split('/').pop()!, path, kind: 'file' as const, children: [] });
    const groups = linkedDirectoryNodes([file('/a/z.png'), file('/b/c.md'), file('/a/b.png')]);
    expect(groups.map(group => [group.path, group.children.map(child => child.name)])).toEqual([
      ['/a', ['b.png', 'z.png']],
      ['/b', ['c.md']],
    ]);
    expect(groups.every(group => group.kind === 'directory' && group.childrenLoaded)).toBe(true);
  });
});
