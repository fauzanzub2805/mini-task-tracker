import { useEffect, useRef, useState } from 'react';

// Kartu notifikasi tetap memakai popup; ikon Chat langsung menuju halaman
// Profile > Message dan menampilkan jumlah pesan belum dibaca dari backend.
// Items notifikasi: { id, recipientId, title, body, readAt }.
export function HeaderInbox({ userId, notifications = [], chatUnread = 0, unreadCount, loading = false, error = '', busy = false, onRead, onReadAll, onRetry, onLoadMore }) {
    const [open, setOpen] = useState(false);
    const [read, setRead] = useState([]);
    const root = useRef(null);
    const trigger = useRef(null);
    const closeButton = useRef(null);
    const items = userId == null ? [] : notifications.filter(item => String(item.recipientId) === String(userId));
    const isUnread = item => !item.readAt && !read.includes(item.id);
    const unread = unreadCount ?? items.filter(isUnread).length;

    useEffect(() => {
        if (!open) return undefined;
        closeButton.current?.focus();
        const outside = event => {
            if (!root.current?.contains(event.target)) setOpen(false);
        };
        const escape = event => {
            if (event.key === 'Escape') {
                setOpen(false);
                trigger.current?.focus();
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return <div className="dashboard-inbox" ref={root}>
        <button
            ref={trigger}
            type="button"
            className="dashboard-inbox-trigger"
            aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
            aria-expanded={open}
            aria-controls={open ? 'dashboard-inbox-panel' : undefined}
            onClick={() => setOpen(value => !value)}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 17V10a7 7 0 0 1 14 0v7l1 2H4l1-2Z" />
                <path d="M12 2V1m0 18v2" />
            </svg>
            {unread > 0 && <><span className="dashboard-unread-dot" aria-hidden="true" /><span className="dashboard-notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span></>}
        </button>

        <a
            className="dashboard-inbox-trigger"
            href="/profile/messages"
            aria-label={`Chat${chatUnread ? `, ${chatUnread} belum dibaca` : ''}`}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3C6.5 3 3 6.4 3 10.5c0 4 3.2 7 8.5 9.5v-3C17 17 21 14.5 21 10.5S17 3 12 3Z" />
                <circle cx="8" cy="10" r=".5" fill="currentColor" />
                <circle cx="12" cy="10" r=".5" fill="currentColor" />
                <circle cx="16" cy="10" r=".5" fill="currentColor" />
            </svg>
            {chatUnread > 0 && <span className="dashboard-unread-count" aria-hidden="true">{chatUnread > 99 ? '99+' : chatUnread}</span>}
        </a>

        {open && <section id="dashboard-inbox-panel" className="dashboard-inbox-panel" aria-labelledby="dashboard-inbox-title">
            <div className="dashboard-inbox-heading">
                <h2 id="dashboard-inbox-title">Notifikasi</h2>
                <button ref={closeButton} type="button" aria-label="Tutup Notifikasi" onClick={() => { trigger.current?.focus(); setOpen(false); }}>×</button>
            </div>
            {onReadAll && unread > 0 && <button type="button" className="dashboard-notification-action" disabled={busy} onClick={onReadAll}>Tandai semua dibaca</button>}
            {error && <div className="dashboard-notification-error" role="alert"><p>{error}</p>{onRetry && <button type="button" disabled={busy} onClick={onRetry}>Coba lagi</button>}</div>}
            {loading && <p role="status" className="dashboard-inbox-empty">Memuat notifikasi…</p>}
            {items.length ? <ul>{items.map(item => <li key={item.id} className={isUnread(item) ? 'is-unread' : ''}>
                <h3>{item.url ? <a href={item.url}>{item.title}</a> : item.title}</h3>
                <p>{item.body}</p>
                {item.createdAt && <time dateTime={item.createdAt}>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time>}
                {isUnread(item) && <button type="button" disabled={busy} onClick={() => onRead ? onRead(item.id) : setRead(previous => [...previous, item.id])}>Tandai dibaca</button>}
            </li>)}</ul> : !loading && !error && <p className="dashboard-inbox-empty">Belum ada notifikasi.</p>}
            {onLoadMore && <button type="button" className="dashboard-notification-action" disabled={busy} onClick={onLoadMore}>Muat lebih banyak</button>}
        </section>}
    </div>;
}
