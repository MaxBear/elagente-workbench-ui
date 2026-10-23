import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import { editorThemeFor, monacoLanguage } from './GraphWorkspaceMonacoEditor';
import { useDocumentThemeRevision } from '../themeHooks';
import { translate } from '../../i18n';
export default function WorkspaceDocumentDiff({
  original,
  modified,
  language,
  dark,
  compact,
}: {
  original: string;
  modified: string;
  language: string;
  dark: boolean;
  compact: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const themeRevision = useDocumentThemeRevision();
  useEffect(() => {
    if (!host.current) return;
    // The same language ids as the editor (`py` → python, unknown → plaintext).
    const left = monaco.editor.createModel(original, monacoLanguage(language));
    const right = monaco.editor.createModel(modified, monacoLanguage(language));
    const editor = monaco.editor.createDiffEditor(host.current, {
      readOnly: true,
      automaticLayout: true,
      renderSideBySide: !compact,
      originalEditable: false,
      theme: editorThemeFor(dark, host.current),
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      ariaLabel: translate('files.safeCompare'),
    });
    editor.setModel({ original: left, modified: right });
    return () => {
      editor.dispose();
      left.dispose();
      right.dispose();
    };
  }, [original, modified, language, dark, compact, themeRevision]);
  return (
    <div
      ref={host}
      className="h-full w-full"
      data-testid="workspace-conflict-diff"
    />
  );
}
