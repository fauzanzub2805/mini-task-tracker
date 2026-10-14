import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LOGIN_ENDPOINT,
    LOGOUT_ENDPOINT,
    csrfHeaders,
    describeFailure,
    validateCredentials,
} from './loginCore.js';

const DEFAULT_RETRY_AFTER = 60;

function focusFirstError(fieldErrors) {
    if (typeof document === 'undefined') {
        return;
    }
    const field = ['email', 'password'].find((name) => fieldErrors[name]);
    if (field) {
        document.getElementById(field)?.focus();
    }
}

/**
 * Hook perilaku halaman login (React). Semua autentikasi memakai cookie
 * sesi Laravel same-origin; tidak ada state sensitif di storage.
 *
 * @param {{ csrfToken?: string, oldEmail?: string, user?: object|null }} options
 */
export function useLogin(options = {}) {
    const { csrfToken = '', oldEmail = '', user: initialUser = null } = options;

    const [email, setEmail] = useState(oldEmail ?? '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [errorKind, setErrorKind] = useState('');
    const [retryAfter, setRetryAfter] = useState(0);
    const [user, setUser] = useState(initialUser);
    const submitting = useRef(false);
    const logoutPending = useRef(false);

    const isLocked = retryAfter > 0;
    const canSubmit = !loading && !isLocked;

    // Countdown rate limit (429): satu detik per tick.
    useEffect(() => {
        if (!isLocked) {
            return undefined;
        }
        const id = setInterval(() => setRetryAfter((seconds) => Math.max(0, seconds - 1)), 1000);
        return () => clearInterval(id);
    }, [isLocked]);

    // Sinkronkan pesan throttle dengan sisa detik; bersihkan saat selesai.
    useEffect(() => {
        if (errorKind !== 'throttle') {
            return;
        }
        if (retryAfter === 0) {
            setMessage('');
            setErrorKind('');
        } else {
            setMessage(`Terlalu banyak percobaan masuk. Coba lagi dalam ${retryAfter} detik.`);
        }
    }, [errorKind, retryAfter]);

    const resetFeedback = () => {
        setErrors({});
        setMessage('');
        setErrorKind('');
    };

    const submit = useCallback(async (event) => {
        event?.preventDefault?.();

        // Cegah double submit (klik ganda / Enter berulang).
        if (submitting.current || retryAfter > 0) {
            return;
        }

        resetFeedback();

        const clientErrors = validateCredentials({ email, password });
        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            setErrorKind('validation');
            setMessage('Periksa kembali data yang Anda masukkan.');
            focusFirstError(clientErrors);
            return;
        }

        submitting.current = true;
        setLoading(true);

        try {
            const response = await fetch(LOGIN_ENDPOINT, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...csrfHeaders(csrfToken, typeof document !== 'undefined' ? document.cookie : ''),
                },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const body = await response.json().catch(() => ({}));

            if (response.ok) {
                setUser(body?.data ?? null);
                setPassword('');
                setShowPassword(false);
                return;
            }

            const failure = describeFailure(
                response.status,
                body,
                response.headers?.get?.('Retry-After') ?? null,
            );
            setErrors(failure.fieldErrors);
            setErrorKind(failure.kind);
            setMessage(failure.message);

            if (failure.kind === 'validation') {
                setPassword('');
                focusFirstError(failure.fieldErrors);
            }
            if (failure.kind === 'throttle') {
                setRetryAfter(failure.retryAfter ?? DEFAULT_RETRY_AFTER);
            }
        } catch (error) {
            setErrorKind('network');
            setMessage('Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    }, [loading, retryAfter, email, password, csrfToken]);

    const logout = useCallback(async () => {
        if (logoutPending.current) {
            return;
        }
        logoutPending.current = true;
        setLoggingOut(true);

        try {
            await fetch(LOGOUT_ENDPOINT, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...csrfHeaders(csrfToken, typeof document !== 'undefined' ? document.cookie : ''),
                },
            });
        } catch (error) {
            // Abaikan: muat ulang halaman tetap menampilkan status sesi yang sebenarnya.
        } finally {
            // Reload agar halaman mendapat token CSRF baru dari server.
            window.location.reload();
        }
    }, [loggingOut, csrfToken]);

    const reloadPage = useCallback(() => window.location.reload(), []);

    return {
        email,
        password,
        showPassword,
        loading,
        loggingOut,
        errors,
        message,
        errorKind,
        retryAfter,
        isLocked,
        canSubmit,
        user,
        csrfToken,
        setEmail,
        setPassword,
        setShowPassword,
        togglePassword: () => setShowPassword((value) => !value),
        clearFieldError(field) {
            setErrors((current) => {
                if (!current[field]) {
                    return current;
                }
                const { [field]: _removed, ...rest } = current;
                return rest;
            });
        },
        submit,
        logout,
        reloadPage,
    };
}
