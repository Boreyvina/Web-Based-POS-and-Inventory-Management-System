export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger-fg">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

/** An empty screen is an invitation to act, so it always carries the action. */
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    ok: 'bg-ok-bg text-ok-fg',
    warn: 'bg-warn-bg text-warn-fg',
    danger: 'bg-danger-bg text-danger-fg',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
