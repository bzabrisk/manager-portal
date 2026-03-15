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
  },
  payouts: {
    today: () => request('/payouts/today'),
    todaySummary: () => request('/payouts/today/summary'),
    update: (recordId, data) => request(`/payouts/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },
};
