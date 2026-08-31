/**
 * Works out where the backend lives.
 *
 * The catch this solves: VITE_API_URL is usually http://localhost:5000/api.
 * That is correct on the computer running the backend, but when you open the
 * app from a phone or tablet on the same wifi, "localhost" means the PHONE —
 * which has no backend on it. So if the page is being served over the network,
 * we point the API at the same host the page came from.
 */
function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL;
  const { protocol, hostname } = window.location;
  const pageIsLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  if (configured) {
    if (!pageIsLocal && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured)) {
      return configured.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${hostname}`);
    }
    return configured;
  }

  // Nothing configured: assume the backend is on the same machine, port 5000.
  return `${protocol}//${hostname}:5000/api`;
}

export const API_BASE = resolveApiBase();

/** Same origin without the /api suffix — used for uploaded images. */
export const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
