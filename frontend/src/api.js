const API_BASE = '';

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const api = {
  clients: {
    list: () => request('/clients'),
    get: (id) => request(`/clients/${id}`),
    create: (body) => request('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  },
  invoices: {
    list: (params) => {
      const q = new URLSearchParams(params).toString();
      return request(`/invoices${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/invoices/${id}`),
    preview: (body) => request('/invoices/preview', { method: 'POST', body: JSON.stringify(body) }),
    generate: (body) => request('/invoices/generate', { method: 'POST', body: JSON.stringify(body) }),
    pdfUrl: (id) => `${API_BASE}/api/invoices/${id}/pdf`,
    sendEmail: (id) => request(`/invoices/${id}/send`, { method: 'POST' }),
    updateStatus: (id, status) =>
      request(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
};
