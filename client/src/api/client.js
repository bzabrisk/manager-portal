const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.location.reload();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

async function uploadRequest(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401) {
    window.location.reload();
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  return res.json();
}

export const api = {
  auth: {
    login: (password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
    check: () => request('/auth/check'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  tasks: {
    list: () => request('/tasks'),
    update: (id, data) => request(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    create: (data) => request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  fundraisers: {
    list: () => request('/fundraisers/list'),
    upcoming: () => request('/fundraisers/upcoming'),
    upcomingCount: () => request('/fundraisers/upcoming/count'),
    active: () => request('/fundraisers/active'),
    activeCount: () => request('/fundraisers/active/count'),
    ended: () => request('/fundraisers/ended'),
    endedCount: () => request('/fundraisers/ended/count'),
    getDetail: (recordId) => request(`/fundraisers/${recordId}`),
    update: (recordId, data) => request(`/fundraisers/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    lookupReps: () => request('/fundraisers/lookup/reps'),
    lookupContacts: () => request('/fundraisers/lookup/contacts'),
    lookupAccountingContacts: () => request('/fundraisers/lookup/accounting-contacts'),
    lookupProducts: () => request('/fundraisers/lookup/products'),
    uploadMdPayoutReport: (recordId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadRequest(`/fundraisers/${recordId}/upload-md-payout-report`, formData);
    },
    extractMdPayout: (recordId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadRequest(`/fundraisers/${recordId}/extract-md-payout`, formData);
    },
    saveMdPayout: (recordId, file, values) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('values', JSON.stringify(values));
      return uploadRequest(`/fundraisers/${recordId}/save-md-payout`, formData);
    },
  },
  payouts: {
    today: () => request('/payouts/today'),
    todaySummary: () => request('/payouts/today/summary'),
    update: (recordId, data) => request(`/payouts/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },
  chat: {
    send: (messages) => request('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
    weeklySummary: () => request('/chat/weekly-summary'),
  },
  email: {
    preview: (taskId) => request(`/email/preview/${taskId}`),
    send: (data) => request('/email/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  cost: {
    preview: (taskId) => request(`/cost/preview/${taskId}`),
    save: (data) => request('/cost/save', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  echeck: {
    preview: (taskId) => request(`/echeck/preview/${taskId}`),
    send: (data) => request('/echeck/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    sendReportEmail: (data) => request('/echeck/send-report-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    bulkPreview: (repKey) => request(`/echeck/bulk-preview/${repKey}`),
    bulkSend: (data) => request('/echeck/bulk-send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    zeroCommission: (data) => request('/echeck/zero-commission', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
};
