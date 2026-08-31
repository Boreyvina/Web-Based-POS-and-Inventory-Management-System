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

/** YYYY-MM-DD for <input type="date"> and API filters. */
export function toInputDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function daysAgo(n) {
  return toInputDate(Date.now() - n * 86400000);
}
