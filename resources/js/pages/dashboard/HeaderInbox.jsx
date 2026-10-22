import { useEffect, useRef, useState } from 'react';
import { ChatPrototype } from './ChatPrototype.jsx';

// Items: { id, recipientId, title, body, readAt }. Supply authenticated data
// from the backend when messaging is implemented; no demo unread indicators.
export function HeaderInbox({ userId, notifications = [], messages = [] }) {
    const [open, setOpen] = useState(null);
    const [read, setRead] = useState({ notifications: [], messages: [] });
    const root = useRef(null);
    const triggers = useRef({});
    const closeButton = useRef(null);
    const feeds = { notifications, messages };
    const labels = { notifications: 'Notifikasi', messages: 'Chat' };
    const itemsFor = type => userId == null ? [] : feeds[type].filter(item => String(item.recipientId) === String(userId));
    const isUnread = (type, item) => !item.readAt && !read[type].includes(item.id);

    useEffect(() => {
        if (!open) return;
        closeButton.current?.focus();
        const outside = event => {
            if (!root.current?.contains(event.target)) setOpen(null);
        };
        const escape = event => {
            if (event.key === 'Escape') {
                setOpen(null);
                triggers.current[open]?.focus();
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
        {Object.keys(feeds).map(type => {
            const unread = itemsFor(type).filter(item => isUnread(type, item)).length;
            return <button key={type} ref={element => { triggers.current[type] = element; }} type="button" className="dashboard-inbox-trigger" aria-label={`${labels[type]}${unread ? `, ${unread} belum dibaca` : ''}`} aria-expanded={open === type} aria-controls={open === type ? 'dashboard-inbox-panel' : undefined} onClick={() => setOpen(open === type ? null : type)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {type === 'notifications' ? <><path d="M5 17V10a7 7 0 0 1 14 0v7l1 2H4l1-2Z" /><path d="M12 2V1m0 18v2" /></> : <><path d="M12 3C6.5 3 3 6.4 3 10.5c0 4 3.2 7 8.5 9.5v-3C17 17 21 14.5 21 10.5S17 3 12 3Z" /><circle cx="8" cy="10" r=".5" fill="currentColor" /><circle cx="12" cy="10" r=".5" fill="currentColor" /><circle cx="16" cy="10" r=".5" fill="currentColor" /></>}
                </svg>
                {unread > 0 && <span className="dashboard-unread-dot" aria-hidden="true" />}
            </button>;
        })}
        {open && <section id="dashboard-inbox-panel" className={`dashboard-inbox-panel ${open === 'messages' ? 'dashboard-chat-panel' : ''}`} aria-labelledby="dashboard-inbox-title">
            <div className="dashboard-inbox-heading"><h2 id="dashboard-inbox-title">{labels[open]}</h2><button ref={closeButton} type="button" aria-label={`Tutup ${labels[open]}`} onClick={() => { triggers.current[open]?.focus(); setOpen(null); }}>×</button></div>
            {itemsFor(open).length ? <ul>{itemsFor(open).map(item => <li key={item.id} className={isUnread(open, item) ? 'is-unread' : ''}>
                <h3>{item.title}</h3><p>{item.body}</p>
                {isUnread(open, item) && <button type="button" onClick={() => setRead(previous => ({ ...previous, [open]: [...previous[open], item.id] }))}>Tandai dibaca</button>}
            </li>)}</ul> : <p className="dashboard-inbox-empty">{open === 'notifications' ? 'Belum ada notifikasi.' : 'Belum ada pesan masuk.'}</p>}
            {open === 'messages' && <ChatPrototype />}
        </section>}
    </div>;
}
