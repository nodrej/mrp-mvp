import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Product API
export const productAPI = {
  getAll: (params?: { search?: string; type?: string }) =>
    api.get('/products', { params }),

  getById: (id: number) =>
    api.get(`/products/${id}`),

  create: (data: any) =>
    api.post('/products', data),

  update: (id: number, data: any) =>
    api.put(`/products/${id}`, data),

  delete: (id: number) =>
    api.delete(`/products/${id}`),

  getBOM: (id: number) =>
    api.get(`/products/${id}/bom`),

  saveBOM: (id: number, bomLines: any[]) =>
    api.post(`/products/${id}/bom`, bomLines),
};

// Inventory API
export const inventoryAPI = {
  getAll: () =>
    api.get('/inventory'),

  getByProduct: (productId: number) =>
    api.get(`/inventory/${productId}`),

  adjust: (data: { product_id: number; quantity_change: number; reason?: string; notes?: string }) =>
    api.post('/inventory/adjust', data),
};

// Demand API
export const demandAPI = {
  get: (productId: number, days?: number) =>
    api.get(`/demand/${productId}`, { params: { days } }),

  save: (data: { product_id: number; demands: any[] }) =>
    api.post('/demand', data),
};

// MRP API
export const mrpAPI = {
  calculate: (days?: number) =>
    api.post('/mrp/calculate', null, { params: { days } }),

  getShortages: (days?: number) =>
    api.get('/mrp/shortages', { params: { days } }),

  getDashboard: () =>
    api.get('/dashboard'),
};

export default api;
