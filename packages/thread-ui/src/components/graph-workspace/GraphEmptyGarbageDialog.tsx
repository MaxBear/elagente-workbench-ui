import { translate, useI18n } from '../../i18n';
interface GraphEmptyGarbageDialogProps {
  files: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function GraphEmptyGarbageDialog({
  files,
  onCancel,
  onConfirm,
}: GraphEmptyGarbageDialogProps) {
  useI18n();
  return (
    <div className="thread-graph-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="thread-graph-dialog w-full max-w-sm rounded-xl border bg-[var(--theme-panel)] p-6 shadow-xl">
        <h3 className="text-base font-semibold text-[var(--theme-fg)]">
          {translate("files.emptyGarbage")}</h3>
        <p className="mt-1 text-sm leading-5 text-[var(--theme-fg-muted)]">
          {translate("files.permanentlyDeleteAllFilesInThe")}{' '}
          <code className="rounded bg-[var(--theme-muted)] px-1 text-xs text-[var(--theme-fg-soft)]">
            garbage/
          </code>{' '}
          {translate("files.folder")}</p>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--theme-fg-muted)]">
            {translate("files.garbageIsEmpty")}</p>
        ) : (
          <ul className="mt-3 max-h-40 overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 text-xs text-[var(--theme-fg-soft)]">
            {files.map((file) => (
              <li key={file} className="truncate py-0.5" title={file}>
                {file}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="thread-secondary-action rounded-md px-3 py-1.5 text-sm"
          >
            {translate("files.cancel")}</button>
          {files.length > 0 ? (
            <button
              type="button"
              onClick={onConfirm}
              className="ui-action-danger rounded-md px-3 py-1.5 text-sm font-medium"
            >
              {translate("files.yesEmptyGarbage")}</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
