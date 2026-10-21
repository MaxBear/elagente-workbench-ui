import { translate, useI18n } from '../../i18n';
export function ComposerGoalComposeCard({
  tokenBudget,
  error,
  onTokenBudgetChange,
  onCancel,
}: {
  tokenBudget: string;
  error: string | null;
  onTokenBudgetChange: (value: string) => void;
  onCancel: () => void;
}) {
  useI18n();
  return (
    <div className="thread-goal-compose-card relative z-20 mb-1.5 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm">
      <span className="thread-goal-compose-label font-medium uppercase tracking-[0.16em]">
        {translate("chat.goal")}</span>
      <label className="thread-goal-compose-field flex items-center gap-2">
        <span>{translate("chat.maxTokensK")}</span>
        <input
          aria-label={translate("chat.goalTokenBudget")}
          value={tokenBudget}
          onChange={(event) => onTokenBudgetChange(event.target.value)}
          inputMode="numeric"
          placeholder={translate("chat.optional")}
          className="thread-goal-compose-input h-7 w-24 rounded-full border px-3 text-xs outline-none"
        />
      </label>
      {error ? (
        <span className="thread-goal-compose-error min-w-0 flex-1">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onCancel}
        className="thread-goal-compose-cancel rounded-full border px-2.5 py-1 text-[11px] transition"
      >
        {translate("chat.cancel")}</button>
    </div>
  );
}
