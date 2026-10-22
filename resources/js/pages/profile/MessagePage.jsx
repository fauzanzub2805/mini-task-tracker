import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ALLOWED_ATTACHMENT_EXTENSIONS,
    ApiError,
    ATTACHMENT_ACCEPT,
    MAX_ATTACHMENT_BYTES,
    messagingApi,
} from '../../lib/messagingApi.js';
import { formatDateTime, formatSize, formatTime, initials } from '../../lib/format.js';

const POLL_INTERVAL = 5000;
const ALLOWED_EXTENSIONS = new Set(ALLOWED_ATTACHMENT_EXTENSIONS);

function statusLabel(status) {
    if (status === 'unread') return 'Pesan masuk belum dibaca';
    if (status === 'awaiting_reply') return 'Pesan masuk sudah dibaca, belum dibalas';
    return '';
}

function Highlight({ text, query }) {
    const value = String(text ?? '');
    const needle = String(query ?? '').trim();

    if (!needle) return value;

    const lower = value.toLocaleLowerCase('id-ID');
    const target = needle.toLocaleLowerCase('id-ID');
    const parts = [];
    let index = 0;
    let found = lower.indexOf(target);

    while (found !== -1) {
        if (found > index) parts.push(value.slice(index, found));
        parts.push(<mark key={`${found}-${parts.length}`}>{value.slice(found, found + needle.length)}</mark>);
        index = found + needle.length;
        found = lower.indexOf(target, index);
    }

    if (!parts.length) return value;
    if (index < value.length) parts.push(value.slice(index));
    return <>{parts}</>;
}

function extensionOf(file) {
    return (file?.name ?? '').split('.').pop()?.toLocaleLowerCase('id-ID') ?? '';
}

// Gabungkan pesan baru tanpa membuat duplikat ketika polling dan respons POST
// sama-sama membawa pesan yang sama.
function mergeMessage(previous, incoming) {
    if (!incoming) return previous;
    const byId = new Map(previous.map(item => [item.id, item]));
    byId.set(incoming.id, incoming);
    return [...byId.values()].sort((left, right) => left.id - right.id);
}

export function MessagePage({ user, onUnreadChange }) {
    const userId = user?.id ?? null;
    const [conversations, setConversations] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [people, setPeople] = useState([]);
    const [selected, setSelected] = useState(null);
    const [messages, setMessages] = useState([]);
    // Pemilik array `messages` saat ini. Mencegah pesan lama ikut ditandai
    // dibaca ketika pengguna berpindah lawan bicara sebelum thread baru termuat.
    const [threadOwnerId, setThreadOwnerId] = useState(null);
    const [threadLoading, setThreadLoading] = useState(false);
    const [threadError, setThreadError] = useState(null);
    const [sending, setSending] = useState(false);
    const [markingRead, setMarkingRead] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [composerError, setComposerError] = useState(null);
    const [fileErrors, setFileErrors] = useState({});
    const [drafts, setDrafts] = useState({});
    const [files, setFiles] = useState({});
    const [visibleTick, setVisibleTick] = useState(0);

    const selectedRef = useRef(null);
    const threadSequence = useRef(0);
    const listSequence = useRef(0);
    // Dinaikkan sebelum dan sesudah setiap mutasi (kirim/hapus/tandai baca)
    // supaya respons GET yang masih berjalan tidak menimpa hasil mutasi.
    const mutationRevision = useRef(0);
    const readSequence = useRef(0);
    const readThrough = useRef(new Map());
    const fileInput = useRef(null);
    const bottom = useRef(null);
    const logRef = useRef(null);
    const nearBottom = useRef(true);
    const threadRenderKey = useRef(null);
    const lastRenderedMessageId = useRef(null);
    const searchTimer = useRef(null);

    selectedRef.current = selected;

    const draft = selected ? drafts[selected.id] ?? '' : '';
    const file = selected ? files[selected.id] ?? null : null;
    const pendingFileError = selected ? fileErrors[selected.id] ?? '' : '';

    const setDraft = useCallback((value) => {
        const partner = selectedRef.current;
        if (!partner) return;
        setDrafts(previous => ({ ...previous, [partner.id]: value }));
    }, []);

    const setFile = useCallback((next) => {
        const partner = selectedRef.current;
        if (!partner) return;
        setFiles(previous => ({ ...previous, [partner.id]: next }));
    }, []);

    const loadConversations = useCallback(async ({ quiet = false } = {}) => {
        if (!userId) return;
        const sequence = ++listSequence.current;

        if (!quiet) setListLoading(true);

        try {
            const data = await messagingApi.conversations(query);
            if (sequence !== listSequence.current) return;
            setConversations(Array.isArray(data?.data) ? data.data : []);
            onUnreadChange?.(data?.unread_count ?? 0);
            setListError(null);
        } catch (error) {
            if (sequence !== listSequence.current || error?.name === 'AbortError') return;
            setListError(error);
        } finally {
            if (sequence === listSequence.current) setListLoading(false);
        }
    }, [query, userId, onUnreadChange]);

    // Daftar percakapan: muat awal, lalu polling 5 detik saat tab terlihat.
    useEffect(() => {
        loadConversations();

        const poll = () => {
            if (document.visibilityState === 'hidden') return;
            loadConversations({ quiet: true });
        };
        const timer = setInterval(poll, POLL_INTERVAL);
        const onVisibility = () => {
            setVisibleTick(tick => tick + 1);
            poll();
        };

        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            listSequence.current += 1;
        };
    }, [loadConversations]);

    // Pencarian pengguna lain (nama) untuk memulai percakapan baru.
    useEffect(() => {
        if (!userId || query.trim() === '') {
            setPeople([]);
            return undefined;
        }

        let active = true;
        messagingApi.users(query)
            .then(data => { if (active) setPeople(Array.isArray(data?.data) ? data.data : []); })
            .catch(() => { if (active) setPeople([]); });

        return () => { active = false; };
    }, [query, userId]);

    const loadMessages = useCallback(async (partner, { quiet = false } = {}) => {
        if (!partner) return;
        const sequence = ++threadSequence.current;
        const revision = mutationRevision.current;

        if (!quiet) {
            setThreadLoading(true);
            setThreadError(null);
        }

        try {
            const data = await messagingApi.messages(partner.id);
            // Abaikan respons yang sudah disusul permintaan lebih baru atau
            // mutasi (kirim/hapus/tandai baca) selama GET berjalan.
            if (sequence !== threadSequence.current || revision !== mutationRevision.current) return;
            setMessages(Array.isArray(data?.data) ? data.data : []);
            setThreadOwnerId(partner.id);
        } catch (error) {
            if (sequence !== threadSequence.current || revision !== mutationRevision.current || error?.name === 'AbortError') return;
            if (!quiet) {
                setThreadError(error);
                setMessages([]);
                setThreadOwnerId(partner.id);
            }
        } finally {
            if (sequence === threadSequence.current) setThreadLoading(false);
        }
    }, []);

    // Muat thread terpilih + polling pesan baru.
    useEffect(() => {
        if (!selected) {
            setMessages([]);
            setThreadOwnerId(null);
            return undefined;
        }

        threadSequence.current += 1;
        setMessages([]);
        setThreadOwnerId(null);
        loadMessages(selected);

        const poll = () => {
            if (document.visibilityState === 'hidden') return;
            if (selectedRef.current?.id !== selected.id) return;
            loadMessages(selected, { quiet: true });
        };
        const timer = setInterval(poll, POLL_INTERVAL);

        return () => {
            clearInterval(timer);
            threadSequence.current += 1;
        };
    }, [selected, loadMessages]);

    // Tandai dibaca hanya untuk pesan masuk yang benar-benar tampil, dan hanya
    // sampai id terakhir yang terlihat. `readThrough` mencegah polling tanpa henti.
    useEffect(() => {
        if (!selected || !userId) return undefined;
        // Pesan yang masih tampil berasal dari lawan bicara sebelumnya.
        if (threadOwnerId !== selected.id) return undefined;
        if (document.visibilityState === 'hidden') return undefined;

        const incoming = messages.filter(message => message.sender_id !== userId && !message.read_at);
        if (!incoming.length) return undefined;

        const throughId = incoming[incoming.length - 1].id;
        const key = String(selected.id);
        if ((readThrough.current.get(key) ?? 0) >= throughId) return undefined;

        readThrough.current.set(key, throughId);
        const requestId = ++readSequence.current;
        let active = true;

        messagingApi.read(selected.id, throughId)
            .then(data => {
                if (!active || requestId !== readSequence.current) return;
                onUnreadChange?.(data?.unread_count ?? 0);
                const remaining = data?.data?.unread_count ?? 0;
                const last = messages[messages.length - 1];
                const awaiting = remaining === 0 && last && last.sender_id !== userId;

                setConversations(previous => previous.map(conversation => conversation.user.id === selected.id
                    ? {
                        ...conversation,
                        unread_count: remaining,
                        status: remaining > 0 ? 'unread' : (awaiting ? 'awaiting_reply' : null),
                    }
                    : conversation));
            })
            .catch(error => {
                if (!active || requestId !== readSequence.current) return;
                if (error?.name === 'AbortError') return;
                readThrough.current.set(key, 0);
                setListError(error);
            });

        return () => { active = false; };
    }, [messages, selected, threadOwnerId, userId, visibleTick, onUnreadChange]);

    // Gulir ke bawah hanya saat thread pertama kali tampil, saat pengguna
    // mengirim pesan sendiri, atau saat ia memang sedang berada di dasar thread.
    useEffect(() => {
        const partnerId = selected?.id ?? null;

        if (partnerId === null) {
            threadRenderKey.current = null;
            lastRenderedMessageId.current = null;
            nearBottom.current = true;
            return;
        }

        const lastMessage = messages[messages.length - 1] ?? null;
        const lastId = lastMessage?.id ?? null;

        if (threadRenderKey.current !== partnerId) {
            threadRenderKey.current = partnerId;
            lastRenderedMessageId.current = lastId;
            nearBottom.current = true;
            bottom.current?.scrollIntoView?.({ block: 'end' });
            return;
        }

        const previousLastId = lastRenderedMessageId.current;
        lastRenderedMessageId.current = lastId;

        if (lastId === null || lastId === previousLastId) return;

        if (nearBottom.current || lastMessage.sender_id === userId) {
            nearBottom.current = true;
            bottom.current?.scrollIntoView?.({ block: 'end' });
        }
    }, [messages, selected, userId]);

    useEffect(() => () => window.clearTimeout(searchTimer.current), []);

    function selectPartner(partner) {
        if (!partner) return;
        setComposerError(null);
        setFileErrors({});
        if (fileInput.current) fileInput.current.value = '';
        setThreadOwnerId(null);
        setSelected({ id: partner.id, name: partner.name });
    }

    function chooseFile(event) {
        const picked = event.target.files?.[0] ?? null;
        const partner = selectedRef.current;
        setComposerError(null);
        if (!picked || !partner) return;

        const extension = extensionOf(picked);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
            event.target.value = '';
            setFile(null);
            setFileErrors(previous => ({ ...previous, [partner.id]: `Jenis file .${extension || '?'} tidak diizinkan. Gunakan: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}.` }));
            return;
        }

        if (picked.size > MAX_ATTACHMENT_BYTES) {
            event.target.value = '';
            setFile(null);
            setFileErrors(previous => ({ ...previous, [partner.id]: 'Ukuran lampiran maksimal 10 MB.' }));
            return;
        }

        setFileErrors(previous => ({ ...previous, [partner.id]: '' }));
        setFile(picked);
    }

    function clearFile() {
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
    }

    async function send(event) {
        event.preventDefault();
        const partner = selectedRef.current;
        if (!partner || sending) return;

        const draftSnapshot = drafts[partner.id] ?? '';
        const body = draftSnapshot.trim();
        const attachmentSnapshot = files[partner.id] ?? null;

        if (!body && !attachmentSnapshot) {
            setComposerError(new ApiError('Tulis pesan atau lampirkan file terlebih dahulu.', 422));
            return;
        }

        const form = new FormData();
        if (body) form.append('body', body);
        if (attachmentSnapshot) form.append('attachment', attachmentSnapshot);

        setSending(true);
        setComposerError(null);
        // Batalkan GET thread yang sudah berjalan sebelum POST dikirim.
        mutationRevision.current += 1;

        try {
            const data = await messagingApi.send(partner.id, form);
            // Batalkan GET yang sempat dimulai selama POST berjalan.
            mutationRevision.current += 1;
            if (selectedRef.current?.id === partner.id) {
                setMessages(previous => mergeMessage(previous, data.data));
            }
            // Hanya bersihkan compositor bila isinya masih sama dengan snapshot
            // saat dikirim; teks yang diketik selama POST tidak boleh hilang.
            setDrafts(previous => (previous[partner.id] ?? '') === draftSnapshot
                ? { ...previous, [partner.id]: '' }
                : previous);
            setFiles(previous => (previous[partner.id] ?? null) === attachmentSnapshot
                ? { ...previous, [partner.id]: null }
                : previous);
            if (attachmentSnapshot && fileInput.current?.files?.[0] === attachmentSnapshot) {
                fileInput.current.value = '';
            }

            // Segarkan daftar & badge tanpa menunggu polling berikutnya.
            loadConversations({ quiet: true });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            if (selectedRef.current?.id === partner.id) setComposerError(error);
        } finally {
            setSending(false);
        }
    }

    async function removeMessage(message) {
        if (deletingId != null) return;
        setDeletingId(message.id);
        setComposerError(null);
        mutationRevision.current += 1;

        try {
            await messagingApi.remove(message.id);
            mutationRevision.current += 1;
            setMessages(previous => previous.filter(item => item.id !== message.id));
            loadConversations({ quiet: true });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            setComposerError(error);
        } finally {
            setDeletingId(null);
        }
    }

    // Tindakan eksplisit pengguna: tandai seluruh pesan masuk yang sudah dimuat
    // sebagai dibaca. Memakai id pesan terbesar yang dimuat (termasuk pesan
    // keluar) sehingga pesan masuk lama di luar jendela 100 terbaru ikut bersih.
    async function markConversationRead() {
        const partner = selectedRef.current;
        if (!partner || markingRead) return;

        const throughId = messages.reduce((max, item) => Math.max(max, item.id), 0);
        if (!throughId) return;

        setMarkingRead(true);
        setComposerError(null);
        mutationRevision.current += 1;
        readSequence.current += 1;

        try {
            const data = await messagingApi.read(partner.id, throughId);
            mutationRevision.current += 1;

            if (selectedRef.current?.id === partner.id) {
                const markedAt = new Date().toISOString();
                setMessages(previous => previous.map(item => (
                    item.sender_id !== userId && item.id <= throughId && !item.read_at
                        ? { ...item, read_at: markedAt }
                        : item
                )));
            }

            onUnreadChange?.(data?.unread_count ?? 0);
            const remaining = data?.data?.unread_count ?? 0;
            const latest = messages[messages.length - 1] ?? null;
            const status = remaining > 0
                ? 'unread'
                : (latest && latest.sender_id !== userId ? 'awaiting_reply' : null);

            setConversations(previous => previous.map(conversation => conversation.user.id === partner.id
                ? { ...conversation, unread_count: remaining, status }
                : conversation));

            loadConversations({ quiet: true });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            setComposerError(error);
        } finally {
            setMarkingRead(false);
        }
    }

    function onLogScroll() {
        const log = logRef.current;
        if (!log) return;
        nearBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight <= 80;
    }

    const knownPartnerIds = new Set(conversations.map(conversation => conversation.user.id));
    const suggestions = people.filter(person => person.id !== userId && !knownPartnerIds.has(person.id));
    const hasSearch = query.trim() !== '';

    return <section className="message-page" aria-labelledby="message-title">
        <h1 id="message-title">Message</h1>
        <p className="message-note">Pencarian mencocokkan nama pengguna dan isi pesan. Setiap percakapan menampilkan maksimal 100 pesan terbaru.</p>
        {listError?.authExpired && <p className="message-auth-error" role="alert">Sesi Anda berakhir. <a href="/login">Masuk kembali</a> untuk melanjutkan.</p>}

        <div className={`message-card ${selected ? 'is-thread-open' : ''}`}>
            <aside className="message-contacts" aria-label="Daftar percakapan">
                <h2 className="message-contacts-title">{user?.name?.trim() || 'Pengguna'}</h2>

                <form className="message-search" role="search" onSubmit={event => event.preventDefault()}>
                    <label className="sr-only" htmlFor="message-search">Cari nama pengguna atau isi pesan</label>
                    <input
                        id="message-search"
                        type="search"
                        placeholder="Search..."
                        value={search}
                        onChange={event => {
                            const value = event.target.value;
                            setSearch(value);
                            window.clearTimeout(searchTimer.current);
                            searchTimer.current = window.setTimeout(() => setQuery(value.trim()), 250);
                        }}
                    />
                    <span aria-hidden="true" className="message-search-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    </span>
                </form>

                {listLoading && !conversations.length && <p className="message-list-state">Memuat percakapan…</p>}
                {!listLoading && !conversations.length && <p className="message-list-state">{hasSearch ? 'Tidak ada percakapan yang cocok.' : 'Belum ada percakapan. Cari nama pengguna untuk memulai.'}</p>}

                <ul className="message-conversations">
                    {conversations.map(conversation => {
                        const isSelected = selected?.id === conversation.user.id;
                        const partner = conversation.user;
                        const status = conversation.status;
                        return <li key={partner.id}>
                            <button
                                type="button"
                                className={`message-conversation ${isSelected ? 'is-selected' : ''}`}
                                aria-current={isSelected ? 'true' : undefined}
                                onClick={() => selectPartner(partner)}
                            >
                                <span className="message-avatar" aria-hidden="true">{initials(partner.name)}</span>
                                <span className="message-conversation-text">
                                    <span className="message-conversation-name">
                                        <span className="message-conversation-label">{partner.name}</span>
                                        {status && <span className={`message-status-dot ${status}`} role="img" aria-label={statusLabel(status)} />}
                                    </span>
                                    <span className="message-conversation-preview">
                                        <Highlight text={conversation.last_message || 'Lampiran'} query={query} />
                                    </span>
                                </span>
                                {conversation.unread_count > 0 && <span className="message-unread-badge" aria-label={`${conversation.unread_count} pesan belum dibaca`}>{conversation.unread_count}</span>}
                            </button>
                        </li>;
                    })}
                </ul>

                {hasSearch && suggestions.length > 0 && <div className="message-suggestions">
                    <h3>Pengguna lain</h3>
                    <ul>{suggestions.map(person => <li key={person.id}>
                        <button type="button" className="message-suggestion" onClick={() => selectPartner(person)}>
                            <span className="message-avatar" aria-hidden="true">{initials(person.name)}</span>
                            <span><strong className="message-conversation-label"><Highlight text={person.name} query={query} /></strong><small>Mulai percakapan</small></span>
                        </button>
                    </li>)}</ul>
                </div>}

                {hasSearch && !listLoading && !suggestions.length && !conversations.length && <p className="message-list-state">Pengguna tidak ditemukan.</p>}
            </aside>

            <section className="message-thread-pane" aria-label={selected ? `Percakapan dengan ${selected.name}` : 'Percakapan'}>
                {!selected && <div className="message-thread-empty">
                    <h2>Pilih percakapan</h2>
                    <p>Pilih kontak di samping atau cari nama pengguna untuk mulai berkirim pesan.</p>
                </div>}

                {selected && <>
                    <header className="message-thread-header">
                        <button type="button" className="message-back" onClick={() => setSelected(null)} aria-label="Kembali ke daftar pesan">‹</button>
                        <span className="message-avatar" aria-hidden="true">{initials(selected.name)}</span>
                        <div>
                            <h2>{selected.name}</h2>
                            <p>Reply to message</p>
                        </div>
                        <button
                            type="button"
                            className="message-mark-read"
                            onClick={markConversationRead}
                            disabled={markingRead || !messages.length}
                        >{markingRead ? 'Menandai…' : 'Tandai percakapan dibaca'}</button>
                    </header>

                    <div
                        className="message-log"
                        role="log"
                        aria-live="polite"
                        aria-label={`Pesan dengan ${selected.name}`}
                        ref={logRef}
                        onScroll={onLogScroll}
                    >
                        {threadLoading && !messages.length && <p className="message-list-state">Memuat pesan…</p>}
                        {!threadLoading && !messages.length && !threadError && <p className="message-list-state">Belum ada pesan. Kirim pesan pertama Anda.</p>}
                        {threadError && <p className="message-thread-error" role="alert">
                            {threadError.authExpired ? <><a href="/login">Masuk kembali</a> untuk melanjutkan.</> : threadError.message}
                        </p>}

                        {messages.map(message => {
                            const own = message.sender_id === userId;
                            return <article key={message.id} className={`message-bubble ${own ? 'is-own' : 'is-incoming'}`}>
                                <span className="message-sender">{own ? (user?.name ?? 'Anda') : selected.name}</span>
                                {message.body && <p className="message-body"><Highlight text={message.body} query={query} /></p>}
                                {message.attachment && <a
                                    className="message-attachment"
                                    href={message.attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={message.attachment.name}
                                >
                                    <span aria-hidden="true">📎</span>
                                    <span className="message-attachment-text">
                                        {message.attachment.name}
                                        <small>{formatSize(message.attachment.size)} · Unduh lampiran</small>
                                    </span>
                                </a>}
                                <footer className="message-meta">
                                    <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>{formatTime(message.created_at)}</time>
                                    {own && <button
                                        type="button"
                                        className="message-delete"
                                        aria-label={`Hapus pesan: ${message.body || message.attachment?.name || message.id}`}
                                        disabled={deletingId === message.id}
                                        onClick={() => removeMessage(message)}
                                    >{deletingId === message.id ? 'Menghapus…' : 'Hapus'}</button>}
                                </footer>
                            </article>;
                        })}
                        <div ref={bottom} />
                    </div>

                    <form className="message-composer" onSubmit={send}>
                        {composerError && <p className="message-composer-error" role="alert">
                            {composerError.authExpired ? <><a href="/login">Masuk kembali</a> untuk melanjutkan.</> : composerError.message}
                        </p>}
                        {pendingFileError && <p className="message-composer-error" role="alert">{pendingFileError}</p>}

                        {file && <div className="message-pending-file">
                            <span>📎 {file.name} <small>{formatSize(file.size)}</small></span>
                            <button type="button" aria-label="Batalkan lampiran" onClick={clearFile}>×</button>
                        </div>}

                        <div className="message-composer-row">
                            <label className="sr-only" htmlFor="message-body">Tulis pesan</label>
                            <textarea
                                id="message-body"
                                rows={2}
                                maxLength={4000}
                                placeholder="Type something here..."
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                            />
                            <label className="message-attach" title={`Lampirkan file (${ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')}, maks. 10 MB)`}>
                                <span className="sr-only">Lampirkan file</span>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.8" /></svg>
                                <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} onChange={chooseFile} />
                            </label>
                            <button
                                className="message-send"
                                type="submit"
                                aria-label="Kirim pesan"
                                disabled={sending || (!draft.trim() && !file)}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg>
                            </button>
                        </div>
                        <p className="message-limit">Maks. 4.000 karakter · lampiran ≤ 10 MB ({ALLOWED_ATTACHMENT_EXTENSIONS.join(', ')})</p>
                    </form>
                </>}
            </section>
        </div>
    </section>;
}
