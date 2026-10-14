/**
 * Logika murni (tanpa DOM/React) halaman login — dipisahkan agar mudah
 * diuji. Alur:
 *  1. Validasi ringan di sisi klien (email & kata sandi wajib).
 *  2. POST JSON ke endpoint backend yang sudah ada: /auth/login (sesi + CSRF).
 *  3. Tangani 200 (sukses), 422 (validasi/kredensial), 419 (CSRF kedaluwarsa),
 *     429 (rate limit), error server lain, dan kegagalan jaringan.
 *
 * Catatan keamanan: tidak ada token atau kata sandi yang disimpan di
 * localStorage/sessionStorage. Autentikasi sepenuhnya memakai cookie sesi
 * Laravel (HttpOnly) yang diatur oleh server.
 */

export const LOGIN_ENDPOINT = '/auth/login';
export const LOGOUT_ENDPOINT = '/auth/logout';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Terjemahan pesan bawaan Laravel (locale backend masih "en"). */
const MESSAGE_TRANSLATIONS = {
    'These credentials do not match our records.': 'Email atau kata sandi tidak cocok. Periksa kembali lalu coba lagi.',
    'The email field is required.': 'Email wajib diisi.',
    'The email field must be a valid email address.': 'Format email tidak valid.',
    'The password field is required.': 'Kata sandi wajib diisi.',
};

export function translateMessage(message) {
    if (typeof message !== 'string') {
        return '';
    }

    return MESSAGE_TRANSLATIONS[message] ?? message;
}

/** Validasi sisi klien. Mengembalikan objek error per field (kosong bila valid). */
export function validateCredentials({ email, password }) {
    const errors = {};
    const trimmedEmail = (email ?? '').trim();

    if (trimmedEmail === '') {
        errors.email = 'Email wajib diisi.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
        errors.email = 'Format email tidak valid.';
    }

    if ((password ?? '') === '') {
        errors.password = 'Kata sandi wajib diisi.';
    }

    return errors;
}

/** Baca cookie XSRF-TOKEN (diperbarui server setelah session regenerate). */
export function readXsrfCookie(cookieString = typeof document !== 'undefined' ? document.cookie : '') {
    const match = cookieString.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : null;
}

/** Header CSRF: utamakan cookie XSRF terbaru, jatuh ke meta tag/bootstrap csrf-token. */
export function csrfHeaders(metaToken, cookieString) {
    const xsrf = readXsrfCookie(cookieString);

    if (xsrf) {
        return { 'X-XSRF-TOKEN': xsrf };
    }

    return metaToken ? { 'X-CSRF-TOKEN': metaToken } : {};
}

/**
 * Ubah respons gagal menjadi state UI yang konsisten.
 * @returns {{ fieldErrors: Record<string,string>, message: string, kind: string, retryAfter?: number }}
 */
export function describeFailure(status, body = {}, retryAfterHeader = null) {
    if (status === 422) {
        const fieldErrors = {};
        for (const [field, messages] of Object.entries(body?.errors ?? {})) {
            fieldErrors[field] = translateMessage(Array.isArray(messages) ? messages[0] : messages);
        }

        return {
            kind: 'validation',
            fieldErrors,
            message: fieldErrors.email && Object.keys(fieldErrors).length === 1 && !fieldErrors.password
                ? fieldErrors.email
                : 'Periksa kembali data yang Anda masukkan.',
        };
    }

    if (status === 419) {
        return {
            kind: 'csrf',
            fieldErrors: {},
            message: 'Sesi halaman sudah kedaluwarsa. Muat ulang halaman lalu coba masuk kembali.',
        };
    }

    if (status === 429) {
        const parsed = Number.parseInt(retryAfterHeader ?? '', 10);
        const retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;

        return {
            kind: 'throttle',
            fieldErrors: {},
            retryAfter,
            message: `Terlalu banyak percobaan masuk. Coba lagi dalam ${retryAfter} detik.`,
        };
    }

    return {
        kind: 'server',
        fieldErrors: {},
        message: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.',
    };
}
