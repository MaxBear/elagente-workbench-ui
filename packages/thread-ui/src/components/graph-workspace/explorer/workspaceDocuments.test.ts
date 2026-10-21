import { describe, expect, it } from 'vitest';
import {
  editDraft,
  newDraft,
  settleSave,
  isProtected,
} from './workspaceDocuments';
import type { WorkspaceDocumentSnapshot } from '../../../adapters';
const snapshot: WorkspaceDocumentSnapshot = {
  path: 'a.txt',
  name: 'a.txt',
  language: 'text',
  workspaceRevision: 'root',
  fileIdentity: 'id',
  contentHash: 'hash',
  content: 'base',
  size: 4,
  encoding: 'utf-8',
  bom: false,
  eol: 'lf',
  readOnlyReason: null,
  truncated: false,
};
describe('workspace document revision settlement', () => {
  it('keeps later typing dirty when an older saved receipt arrives', () => {
    const draft = editDraft(
      newDraft('device:workspace:a', snapshot),
      'submitted',
    );
    const saving = {
      ...draft,
      phase: 'saving' as const,
      submitted: {
        content: draft.content,
        revision: draft.revision,
        operationId: 'operation',
      },
    };
    const later = editDraft(saving, 'later typing');
    const saved = settleSave(later, {
      status: 'saved',
      operationId: 'operation',
      draftRevision: 1,
      path: 'a.txt',
      contentHash: 'newhash',
      fileIdentity: 'newid',
    });
    expect(saved.content).toBe('later typing');
    expect(saved.baseContent).toBe('submitted');
    expect(saved.phase).toBe('dirty');
    expect(saved.revision).toBe(2);
    expect(isProtected(saved)).toBe(true);
  });
  it('ignores a stale operation and retains a fixed conflict while typing', () => {
    const draft = {
      ...editDraft(newDraft('a', snapshot), 'mine'),
      phase: 'saving' as const,
      submitted: { content: 'mine', revision: 1, operationId: 'operation' },
    };
    expect(
      settleSave(draft, {
        status: 'saved',
        operationId: 'other',
        draftRevision: 1,
        path: 'a.txt',
      }),
    ).toBe(draft);
    const conflicted = settleSave(draft, {
      status: 'conflict',
      operationId: 'operation',
      draftRevision: 1,
      path: 'a.txt',
      snapshot: { ...snapshot, content: 'disk', contentHash: 'diskhash' },
    });
    const edited = editDraft(conflicted, 'manual revision');
    expect(edited.phase).toBe('conflict');
    expect(edited.conflict?.content).toBe('disk');
    expect(edited.snapshot.contentHash).toBe('hash');
  });
  it('keeps the submitted revision until unknown results can be reconciled', () => {
    const draft = {
      ...editDraft(newDraft('a', snapshot), 'mine'),
      submitted: { content: 'mine', revision: 1, operationId: 'operation' },
    };
    const pending = settleSave(draft, {
      status: 'pending',
      operationId: 'operation',
      draftRevision: 1,
      path: 'a.txt',
    });
    expect(pending.operationPending).toBe(true);
    expect(isProtected(pending)).toBe(true);
    const unknown = settleSave(pending, {
      status: 'uncertain',
      operationId: 'operation',
      draftRevision: 1,
      path: 'a.txt',
    });
    expect(unknown.phase).toBe('unknown');
    expect(unknown.operationPending).toBe(false);
    expect(unknown.content).toBe('mine');
    expect(unknown.submitted).toEqual(draft.submitted);
    const failed = settleSave(draft, {
      status: 'failedBeforeWrite',
      operationId: 'operation',
      draftRevision: 1,
      path: 'a.txt',
      message: 'forbidden',
    });
    expect(failed.content).toBe('mine');
    expect(failed.phase).toBe('error');
    expect(failed.submitted).toBeUndefined();
  });
});
