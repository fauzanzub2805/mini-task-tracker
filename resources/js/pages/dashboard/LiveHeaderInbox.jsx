import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../../lib/notificationsApi.js';
import { HeaderInbox } from './HeaderInbox.jsx';

export function LiveHeaderInbox({ userId, chatUnread }) {
    const [data, setData] = useState({ data: [], unread_count: 0, through_id: 0 });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const sequence = useRef(0);
    const controller = useRef(null);
    const mutation = useRef(false);
    const mounted = useRef(false);
    const load = useCallback(async (beforeId = null) => {
        if (!userId || mutation.current || document.visibilityState === 'hidden') return;
        const version = ++sequence.current;
        controller.current?.abort();
        controller.current = new AbortController();
        try {
            const result = await notificationsApi.list(beforeId, controller.current.signal);
            if (version !== sequence.current || !mounted.current) return;
            setData(previous => ({ ...result, data: beforeId
                ? [...previous.data, ...result.data.filter(item => !previous.data.some(old => old.id === item.id))]
                : result.data }));
            setError('');
        } catch (failure) {
            if (version === sequence.current && mounted.current && failure.name !== 'AbortError') setError(failure.message);
        } finally {
            if (version === sequence.current && mounted.current) setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        mounted.current = true;
        load();
        const refresh = () => load();
        const timer = setInterval(refresh, 15000);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        window.addEventListener('projects:changed', refresh);
        return () => {
            mounted.current = false;
            ++sequence.current;
            controller.current?.abort();
            clearInterval(timer);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('projects:changed', refresh);
        };
    }, [load]);

    async function markRead(id) {
        if (mutation.current) return;
        mutation.current = true;
        setBusy(true);
        ++sequence.current;
        controller.current?.abort();
        let succeeded = false;
        try {
            if (id == null) await notificationsApi.readAll(data.through_id);
            else await notificationsApi.read(id);
            if (!mounted.current) return;
            setData(previous => ({ ...previous,
                unread_count: id == null ? 0 : Math.max(0, previous.unread_count - (previous.data.some(item => item.id === id && !item.readAt) ? 1 : 0)),
                data: previous.data.map(item => id == null || item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item),
            }));
            setError('');
            succeeded = true;
        } catch (failure) {
            if (mounted.current) setError(failure.message);
        } finally {
            mutation.current = false;
            if (mounted.current) { setBusy(false); if (succeeded) load(); }
        }
    }

    return <HeaderInbox userId={userId} chatUnread={chatUnread} notifications={data.data}
        unreadCount={data.unread_count} loading={loading} error={error} busy={busy}
        onRead={markRead} onReadAll={() => markRead(null)} onRetry={() => load()}
        onLoadMore={data.next_before_id ? () => load(data.next_before_id) : null} />;
}
