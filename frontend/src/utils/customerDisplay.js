/**
 * Keeps the customer-facing screen in sync with the till.
 *
 * BroadcastChannel sends messages between windows of the same browser, so the
 * cashier opens /display on a second monitor (or drags it to a customer-facing
 * screen) and it mirrors the cart live. No server, no websockets, no polling.
 *
 * Limitation worth knowing: same browser, same computer. A tablet on the other
 * side of the counter is a different device and would need the backend to relay
 * the cart instead.
 */
const CHANNEL = 'pos-customer-display';

let channel = null;

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
}

/** Called by the till whenever the cart changes. */
export function publishCart(payload) {
  getChannel()?.postMessage({ type: 'cart', payload, at: Date.now() });
}

/** Called by the till when a sale finishes. */
export function publishSale(sale) {
  getChannel()?.postMessage({ type: 'sale', payload: sale, at: Date.now() });
}

/** Called by the customer screen. Returns an unsubscribe function. */
export function subscribe(handler) {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (event) => handler(event.data);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

export function openCustomerDisplay() {
  window.open('/display', 'pos-customer-display', 'width=900,height=700');
}
