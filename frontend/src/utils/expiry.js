/**
 * Turns the expiry fields the API sends into something a screen can show.
 *
 * The server does the date arithmetic (days_to_expiry, expiry_status) because
 * the server knows what "today" is in the shop's timezone. The browser only
 * decides how to word it.
 */
export function expiryLabel(product) {
  const status = product.expiry_status;
  if (!status || status === 'none') return null;

  const days = Number(product.days_to_expiry ?? product.days_left);

  if (status === 'expired') {
    const ago = Math.abs(days);
    return { tone: 'danger', short: 'Expired', long: ago === 0 ? 'Expires today' : `Expired ${ago} day${ago === 1 ? '' : 's'} ago` };
  }
  if (status === 'expiring') {
    if (days === 0) return { tone: 'danger', short: 'Today', long: 'Expires today' };
    if (days === 1) return { tone: 'warn', short: '1 day', long: 'Expires tomorrow' };
    return { tone: 'warn', short: `${days} days`, long: `Expires in ${days} days` };
  }
  return { tone: 'neutral', short: null, long: `Expires in ${days} days` };
}

/** YYYY-MM-DD from whatever the API sent, for a date input. */
export function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}
