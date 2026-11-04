import { ApiError, csrfToken } from './messagingApi.js';

async function request(path, { body, signal } = {}) {
    const response = await fetch(path, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', signal,
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest',
            ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken() } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status === 401 || response.status === 419
        ? 'Sesi Anda berakhir. Silakan masuk kembali.' : 'Notifikasi gagal diperbarui. Coba lagi.', response.status, data);
    return data;
}

export const notificationsApi = {
    list: (beforeId, signal) => request(`/notifications${beforeId ? `?before_id=${beforeId}` : ''}`, { signal }),
    read: id => request(`/notifications/${id}/read`, { body: {} }),
    readAll: throughId => request('/notifications/read-all', { body: { through_id: throughId } }),
};
