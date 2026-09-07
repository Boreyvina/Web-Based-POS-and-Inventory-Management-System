const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';

export function money(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(n);
}

export function number(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function dateOnly(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * YYYY-MM-DD for <input type="date"> and API filters.
 *
 * A date that already looks like YYYY-MM-DD is sliced rather than parsed.
 * Running it through toISOString would convert to UTC, and for anyone east of
 * London that turns "expires on the 5th" into "expires on the 4th".
 */
export function toInputDate(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(n) {
  return toInputDate(Date.now() - n * 86400000);
}
