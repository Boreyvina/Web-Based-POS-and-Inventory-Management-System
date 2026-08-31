import api from './client';

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  listUsers: () => api.get('/auth/users').then((r) => r.data.data),
  setStatus: (id, isActive) => api.patch(`/auth/users/${id}/status`, { isActive }).then((r) => r.data),
};

export const productApi = {
  list: (params) => api.get('/products', { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data.data),
  byBarcode: (code) => api.get(`/products/barcode/${code}`).then((r) => r.data.data),
  create: (payload) => api.post('/products', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/products/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/products/${id}`).then((r) => r.data),
  adjustStock: (id, payload) => api.patch(`/products/${id}/stock`, payload).then((r) => r.data.data),
  lowStock: () => api.get('/products/alerts/low-stock').then((r) => r.data),
  expiring: (days) => api.get('/products/alerts/expiring', { params: { days } }).then((r) => r.data),
  writeOff: (id, payload) => api.post(`/products/${id}/write-off`, payload).then((r) => r.data),
};

export const uploadApi = {
  /**
   * Sends the file as multipart/form-data. The Content-Type header is left
   * unset on purpose — the browser must add it with the multipart boundary.
   */
  productImage: (file, onProgress) => {
    const data = new FormData();
    data.append('image', file);
    return api
      .post('/uploads/product-image', data, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data.data);
  },
  removeProductImage: (url) => api.delete('/uploads/product-image', { params: { url } }).then((r) => r.data),
};

export const categoryApi = {
  list: () => api.get('/categories').then((r) => r.data.data),
  create: (payload) => api.post('/categories', payload).then((r) => r.data.data),
  update: (id, payload) => api.put(`/categories/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const saleApi = {
  checkout: (payload) => api.post('/sales', payload).then((r) => r.data.data),
  list: (params) => api.get('/sales', { params }).then((r) => r.data),
  get: (id) => api.get(`/sales/${id}`).then((r) => r.data.data),
  void: (id, reason) => api.patch(`/sales/${id}/void`, { reason }).then((r) => r.data),
};

export const reportApi = {
  summary: () => api.get('/reports/summary').then((r) => r.data.data),
  revenue: (params) => api.get('/reports/revenue', { params }).then((r) => r.data.data),
  topProducts: (params) => api.get('/reports/top-products', { params }).then((r) => r.data.data),
  byCategory: (params) => api.get('/reports/sales-by-category', { params }).then((r) => r.data.data),
  stockLevels: (params) => api.get('/reports/stock-levels', { params }).then((r) => r.data.data),
  paymentMethods: (params) => api.get('/reports/payment-methods', { params }).then((r) => r.data.data),
  /**
   * Downloads a report. A plain <a href> cannot carry the JWT header, so we
   * fetch the file as a blob and hand it to the browser ourselves.
   */
  download: async (params) => {
    const res = await api.get('/reports/export', { params, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${params.type}-report-${stamp}.${params.format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const paymentApi = {
  qr: (amount, ref) => api.get('/payments/qr', { params: { amount, ref } }).then((r) => r.data.data),
};

export const inventoryApi = {
  logs: (params) => api.get('/inventory/logs', { params }).then((r) => r.data),
};

export const publicApi = {
  products: (params) => api.get('/public/products', { params }).then((r) => r.data),
  categories: () => api.get('/public/categories').then((r) => r.data.data),
};
