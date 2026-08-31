import { SERVER_ORIGIN } from '../api/base';

export { SERVER_ORIGIN };

/**
 * The database stores relative paths (/uploads/products/x.jpg) so the data
 * survives a domain change. The browser needs an absolute URL, and the API
 * lives on a different port from the website.
 */
export function imageSrc(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
