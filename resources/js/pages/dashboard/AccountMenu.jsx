import { useEffect, useRef, useState } from 'react';
import { LogoutDialog } from './LogoutControl.jsx';

/**
 * Avatar di header: tombol yang membuka menu akun berisi jalan pintas ke
 * Profile dan Logout. Logout memakai dialog konfirmasi yang sama dengan
 * tombol Logout di sidebar.
 */
export function AccountMenu({ user = null, initial = '?' }) {
    const [open, setOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const wrap = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = () => setOpen(false);
        const onPointer = event => {
            if (!wrap.current?.contains(event.target)) close();
        };
        const onKey = event => {
            if (event.key === 'Escape') close();
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        window.addEventListener('app:navigate', close);
        window.addEventListener('popstate', close);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('app:navigate', close);
            window.removeEventListener('popstate', close);
        };
    }, [open]);

    return <div className="dashboard-account-menu" ref={wrap}>
        <button
            type="button"
            className="dashboard-avatar dashboard-avatar-button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Buka menu akun"
            onClick={() => setOpen(!open)}
        >{initial}</button>

        {open && <div className="dashboard-account-dropdown" role="menu" aria-label="Menu akun">
            <a
                className="dashboard-account-menu-item"
                role="menuitem"
                href="/profile"
                onClick={() => setOpen(false)}
            >Profile</a>
            <button
                type="button"
                role="menuitem"
                className="dashboard-account-menu-item dashboard-account-menu-logout"
                disabled={!user}
                title={user ? 'Logout dari akun ini' : 'Logout tidak tersedia dalam preview'}
                onClick={() => { setOpen(false); setLogoutOpen(true); }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                    <path d="M10 8l-4 4 4 4" />
                    <path d="M6 12h9" />
                </svg>
                Logout
            </button>
        </div>}

        <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>;
}

export default AccountMenu;
