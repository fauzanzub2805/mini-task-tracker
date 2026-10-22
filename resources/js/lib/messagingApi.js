// Klien API Profile > Message.
//
// Semua permintaan memakai session cookie (`credentials: 'same-origin'`) dan
// token CSRF dari <meta name="csrf-token">. Respons galat dinormalisasi agar
// komponen hanya perlu menampilkan `error.message` dan dapat membedakan
// sesi kedaluwarsa (401/419) lewat `error.authExpired`.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Selaras dengan StoreDirectMessageRequest::ALLOWED_EXTENSIONS.
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
    'pdf', 'txt', 'csv', 'zip',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'gif', 'webp',
];

export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map(extension => `.${extension}`).join(',');

export function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }

    get authExpired() {
        return this.status === 401 || this.status === 419;
    }
}

function messageFor(data, status) {
    if (status === 401 || status === 419) {
        return 'Sesi Anda berakhir. Silakan masuk kembali.';
    }

    const errors = data?.errors;
    if (errors && typeof errors === 'object') {
        const first = Object.values(errors).find(value => Array.isArray(value) && value.length);
        if (first) return first[0];
    }

    if (typeof data?.message === 'string' && data.message.trim() !== '') {
        return data.message;
    }

    if (status === 403) return 'Anda tidak memiliki akses ke pesan ini.';
    if (status === 404) return 'Data tidak ditemukan.';
    if (status === 422) return 'Data pesan tidak valid.';

    return 'Terjadi kesalahan. Coba lagi.';
}

async function request(path, { method = 'GET', body, signal } = {}) {
    const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (method !== 'GET') headers['X-CSRF-TOKEN'] = csrfToken();

    let payload = body;
    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }

    const response = await fetch(path, {
        method,
        headers,
        body: payload,
        credentials: 'same-origin',
        signal,
    });

    if (response.status === 204) return null;

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new ApiError(messageFor(data, response.status), response.status, data);
    }

    return data;
}

export const messagingApi = {
    users: (query = '', options) => request(`/messaging/users?q=${encodeURIComponent(query)}`, options),
    conversations: (query = '', options) => request(`/messaging/conversations${query ? `?q=${encodeURIComponent(query)}` : ''}`, options),
    messages: (userId, options) => request(`/messaging/users/${userId}/messages`, options),
    send: (userId, formData, options) => request(`/messaging/users/${userId}/messages`, { ...options, method: 'POST', body: formData }),
    read: (userId, throughId, options) => request(`/messaging/users/${userId}/read`, { ...options, method: 'POST', body: { through_id: throughId } }),
    remove: (messageId, options) => request(`/messaging/messages/${messageId}`, { ...options, method: 'DELETE' }),
};
