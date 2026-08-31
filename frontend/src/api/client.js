import axios from 'axios';
import { API_BASE } from './base';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'pos_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Attach the JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Unwrap the backend's error envelope so components can just show err.message,
 * and bounce the user to login if the token died.
 */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    let payload = error.response?.data;

    // Blob downloads fail with a Blob body — read the JSON error out of it.
    if (payload instanceof Blob) {
      try { payload = JSON.parse(await payload.text()); } catch { payload = null; }
    }

    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      tokenStore.clear();
      window.location.href = '/login?expired=1';
    }

    const message =
      payload?.message ||
      (error.code === 'ERR_NETWORK'
        ? 'Cannot reach the server. Is the backend running?'
        : 'Something went wrong');

    return Promise.reject({ message, details: payload?.details || null, status });
  }
);

export default api;
