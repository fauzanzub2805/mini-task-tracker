// Klien API halaman Projects.
//
// Semua permintaan JSON memakai session cookie dan token CSRF dari
// <meta name="csrf-token">. Endpoint HTML (/projects, /projects/{id}, ...)
// dilayani oleh Blade untuk request text/html; modul ini selalu meminta JSON
// lewat header `Accept: application/json`.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Referensi STATUS/Screenshot 2026-10-26 at 09.36.05.png
export const STATUS_OPTIONS = [
    { value: 'todo', label: 'Open Task' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'finish_dev', label: 'Finish Dev' },
    { value: 'testing', label: 'Testing' },
    { value: 'done', label: 'Finished' },
];

// Referensi PRIORITY/Screenshot 2026-10-26 at 09.37.08.png
// Urgent ditambahkan backend belakangan; fallback ini menjaga warna tetap
// sesuai desain dan otomatis memakai id dari API begitu tersedia.
export const PRIORITY_FALLBACK = [
    { id: null, name: 'low', level: 1 },
    { id: null, name: 'medium', level: 2 },
    { id: null, name: 'high', level: 3 },
    { id: null, name: 'urgent', level: 4 },
];

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
    if (status === 401 || status === 419) return 'Sesi Anda berakhir. Silakan masuk kembali.';
    if (status === 403) return 'Anda tidak memiliki akses untuk aksi ini.';

    const errors = data?.errors;
    if (errors && typeof errors === 'object') {
        const first = Object.values(errors).find(value => Array.isArray(value) && value.length);
        if (first) return first[0];
    }

    if (typeof data?.message === 'string' && data.message.trim() !== '') return data.message;
    if (status === 404) return 'Data tidak ditemukan.';
    if (status === 422) return 'Data tidak valid.';

    return 'Terjadi kesalahan. Coba lagi.';
}

async function request(path, { method = 'GET', body, signal } = {}) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (method !== 'GET') headers['X-CSRF-TOKEN'] = csrfToken();

    let payload = body;
    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }

    const response = await fetch(path, { method, headers, body: payload, credentials: 'same-origin', signal });
    if (response.status === 204) return null;

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) throw new ApiError(messageFor(data, response.status), response.status, data);
    return data;
}

async function allPages(path, { signal } = {}) {
    const rows = [];
    let next = path;
    while (next) {
        const body = await request(next, { signal });
        rows.push(...(body?.data ?? []));
        next = body?.links?.next ?? null;
    }
    return rows;
}

export const projectsApi = {
    list: options => allPages('/projects', options),
    get: (id, options) => request(`/projects/${id}`, options),
    create: (payload, options) => request('/projects', { ...options, method: 'POST', body: payload }),
    update: (id, payload, options) => request(`/projects/${id}`, { ...options, method: 'PATCH', body: payload }),
    remove: (id, options) => request(`/projects/${id}`, { ...options, method: 'DELETE' }),

    members: (id, options) => allPages(`/projects/${id}/members`, options),
    addMember: (id, payload, options) => request(`/projects/${id}/members`, { ...options, method: 'POST', body: payload }),
    tasks: (id, options) => allPages(`/projects/${id}/tasks`, options),
    activities: (id, options) => allPages(`/projects/${id}/activities`, options),
    taskActivities: (taskId, options) => allPages(`/tasks/${taskId}/activities`, options),
    users: options => allPages('/users', options),
    priorities: options => request('/priorities', options),

    task: (id, options) => request(`/tasks/${id}`, options),
    createTask: (projectId, payload, options) => request(`/projects/${projectId}/tasks`, { ...options, method: 'POST', body: payload }),
    updateTask: (id, payload, options) => request(`/tasks/${id}`, { ...options, method: 'PATCH', body: payload }),

    // PRD melarang penghapusan komentar, jadi tidak ada endpoint hapus di sini.
    comments: (taskId, options) => allPages(`/tasks/${taskId}/comments`, options),
    // Komentar tanpa lampiran tetap JSON (payload lama dipertahankan). Begitu
    // `files` ada, payload dikirim sebagai multipart: body, mention_ids[],
    // files[]; request() otomatis membiarkan browser menyusun Content-Type.
    addComment: (taskId, payload = {}, options) => {
        let body = payload;
        if (Array.isArray(payload.files)) {
            body = new FormData();
            body.append('body', payload.body ?? '');
            (payload.mention_ids ?? []).forEach(id => body.append('mention_ids[]', String(id)));
            payload.files.forEach(file => body.append('files[]', file, file.name));
        }
        return request(`/tasks/${taskId}/comments`, { ...options, method: 'POST', body });
    },

    uploadAttachments: (taskId, files, options) => {
        const form = new FormData();
        Array.from(files).forEach(file => form.append('files[]', file, file.name));
        return request(`/tasks/${taskId}/attachments`, { ...options, method: 'POST', body: form });
    },
    deleteAttachment: (taskId, attachmentId, options) => request(`/tasks/${taskId}/attachments/${attachmentId}`, { ...options, method: 'DELETE' }),
};

export function statusLabel(status) {
    if (!status) return '';
    const key = String(status).toLowerCase();
    return STATUS_OPTIONS.find(option => option.value === key || option.label.toLowerCase() === key)?.label ?? status;
}

export function statusClass(status) {
    return statusLabel(status).toLowerCase().replaceAll(' ', '-');
}

export function priorityKey(priority) {
    const name = typeof priority === 'string' ? priority : priority?.name;
    return String(name ?? '').toLowerCase();
}

export function priorityLabel(priority) {
    const key = priorityKey(priority);
    return key ? key.charAt(0).toLocaleUpperCase('id-ID') + key.slice(1) : '—';
}

/** Menggabungkan prioritas dari API dengan Urgent agar empat opsi desain selalu ada. */
export function priorityOptions(fetched) {
    const list = Array.isArray(fetched) && fetched.length ? fetched : PRIORITY_FALLBACK;
    const names = new Set(list.map(priorityKey));
    const merged = [...list];
    PRIORITY_FALLBACK.forEach(priority => {
        if (!names.has(priority.name)) merged.push(priority);
    });
    return merged.sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

const pad = value => String(value).padStart(2, '0');

export function parseISODate(value) {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!match) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDay(value) {
    const date = parseISODate(value);
    return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
}

/** "18 September 2026 at 09.17 AM" seperti desain komentar. */
export function formatCommentStamp(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        .format(date)
        .replace(':', '.')
        .toUpperCase();
    return `${day} at ${time}`;
}

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Menyebarkan perubahan agar dashboard "On going Projects & Tasks" ikut memperbarui diri. */
export function notifyProjectsChanged() {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('projects:changed'));
    }
}
