import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../../css/logout.css';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Token CSRF dari meta tag Blade; form juga membawa _token untuk fallback tanpa JS. */
function csrfToken() {
    if (typeof document === 'undefined') {
        return '';
    }

    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

/**
 * Tombol Logout sidebar + dialog konfirmasi.
 *
 * Form tetap berupa POST form biasa ke /auth/logout (dengan _token) sehingga
 * tetap bekerja tanpa JavaScript. Saat JavaScript aktif, submit dicegat agar
 * status sibuk dan kegagalan dapat ditampilkan sebelum diarahkan ke /login.
 */
export function LogoutControl({ enabled = false, onLoggedOut }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const trigger = useRef(null);
    const dialog = useRef(null);
    const cancelButton = useRef(null);
    const wasOpen = useRef(false);

    const redirect = useCallback(() => {
        if (onLoggedOut) {
            onLoggedOut();
            return;
        }

        window.location.assign('/login');
    }, [onLoggedOut]);

    const close = useCallback(() => {
        setOpen(false);
        setError('');
    }, []);

    // Fokus awal ke Cancel (pilihan aman) dan kembalikan fokus ke trigger.
    useEffect(() => {
        if (open) {
            wasOpen.current = true;
            cancelButton.current?.focus();
            return;
        }

        if (wasOpen.current) {
            wasOpen.current = false;
            trigger.current?.focus();
        }
    }, [open]);

    // Escape menutup dialog; Tab/Shift+Tab berputar di dalam dialog.
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!busy) {
                    close();
                }
                return;
            }

            if (event.key !== 'Tab' || !dialog.current) {
                return;
            }

            const focusable = Array.from(dialog.current.querySelectorAll(FOCUSABLE));
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, busy, close]);

    async function submit(event) {
        event.preventDefault();

        if (busy) {
            return;
        }

        const form = event.currentTarget;
        const token = csrfToken();
        const action = form.getAttribute('action') || '/auth/logout';
        const body = new FormData(form);

        if (token && !body.get('_token')) {
            body.set('_token', token);
        }

        setBusy(true);
        setError('');

        try {
            const response = await fetch(action, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body,
            });

            if (!response.ok) {
                setBusy(false);
                setError(response.status === 419
                    ? 'Sesi halaman sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.'
                    : 'Logout gagal. Silakan coba lagi.');
                return;
            }

            setOpen(false);
            redirect();
        } catch {
            setBusy(false);
            setError('Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
        }
    }

    return <>
        <button
            ref={trigger}
            type="button"
            className="dashboard-nav-item dashboard-logout-trigger"
            disabled={!enabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            title={enabled ? 'Logout dari akun ini' : 'Logout tidak tersedia dalam preview'}
            onClick={() => {
                setError('');
                setOpen(true);
            }}
        >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                <path d="M10 8l-4 4 4 4" />
                <path d="M6 12h9" />
            </svg>
            Logout
        </button>

        {open && createPortal(<div
            className="logout-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) {
                    close();
                }
            }}
        >
            <div
                ref={dialog}
                className="logout-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="logout-dialog-title"
                aria-describedby={error ? 'logout-dialog-error' : undefined}
            >
                <span className="logout-dialog-icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3 2.5 20h19L12 3Z" />
                        <path d="M12 9v5" />
                        <circle cx="12" cy="17" r=".6" fill="currentColor" />
                    </svg>
                </span>

                <h2 id="logout-dialog-title">You are about to Logout</h2>

                {error && <p className="logout-dialog-error" id="logout-dialog-error" role="alert">{error}</p>}

                <form className="logout-dialog-form" method="POST" action="/auth/logout" onSubmit={submit}>
                    <input type="hidden" name="_token" value={csrfToken()} readOnly />
                    <div className="logout-dialog-actions">
                        <button
                            ref={cancelButton}
                            type="button"
                            className="logout-button logout-button-cancel"
                            disabled={busy}
                            onClick={() => close()}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="logout-button logout-button-confirm" disabled={busy}>
                            {busy ? 'Logging out…' : 'Logout'}
                        </button>
                    </div>
                </form>
            </div>
        </div>, document.body)}
    </>;
}
