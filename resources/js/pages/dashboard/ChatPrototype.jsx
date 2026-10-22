import { useEffect, useRef, useState } from 'react';

const contacts = [{ id: 'ardhito', name: 'Ardhito Pramono' }, { id: 'zamrud', name: 'Zamrud' }, { id: 'reza', name: 'Reza Artamevia' }];
const maxSize = 10 * 1024 * 1024;

export function ChatPrototype() {
    const [contact, setContact] = useState(contacts[0].id);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [file, setFile] = useState(null);
    const [error, setError] = useState('');
    const fileInput = useRef(null);
    const urls = useRef(new Set());
    const sequence = useRef(0);
    const bottom = useRef(null);
    const selected = contacts.find(person => person.id === contact);
    const thread = messages.filter(message => message.contact === contact);

    useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
    useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages, contact]);

    function clearAttachment() {
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
    }
    function send(event) {
        event.preventDefault();
        if (!draft.trim() && !file) return;
        const url = file ? URL.createObjectURL(file) : null;
        if (url) urls.current.add(url);
        setMessages(previous => [...previous, { id: ++sequence.current, contact, body: draft.trim(), file: file ? { name: file.name, size: file.size, url } : null, sentAt: new Date().toISOString(), own: true }]);
        setDraft('');
        setError('');
        clearAttachment();
    }
    function remove(message) {
        if (message.file) {
            URL.revokeObjectURL(message.file.url);
            urls.current.delete(message.file.url);
        }
        setMessages(previous => previous.filter(item => item.id !== message.id));
    }
    function simulateReply() {
        setMessages(previous => [...previous, { id: ++sequence.current, contact, body: 'Baik, terima kasih. Saya cek dulu ya!', sentAt: new Date().toISOString(), own: false }]);
    }

    return <div className="chat-prototype">
        <p className="chat-demo-note">Demo UI · kontak contoh. Pesan dan file hanya tersimpan sementara selama panel terbuka, bukan dikirim ke server.</p>
        <label className="chat-contact-label" htmlFor="chat-recipient">Kirim kepada</label>
        <select id="chat-recipient" value={contact} onChange={event => { setContact(event.target.value); setDraft(''); clearAttachment(); setError(''); }}>
            {contacts.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <div className="chat-contact-header"><span className="chat-contact-avatar" aria-hidden="true">{selected.name[0]}</span><div><h3>{selected.name}</h3><p>Percakapan demo</p></div></div>
        <div className="chat-thread" role="log" aria-label={`Percakapan dengan ${selected.name}`} aria-live="polite">
            {!thread.length && <p className="chat-empty">Belum ada percakapan. Kirim pesan pertama.</p>}
            {thread.map(message => <div key={message.id} className={`chat-message ${message.own ? 'chat-message-own' : 'chat-message-incoming'}`}>
                <span className="chat-sender">{message.own ? 'Anda' : selected.name}</span>
                {message.body && <p className="chat-message-body">{message.body}</p>}
                {message.file && <a className="chat-file" href={message.file.url} download={message.file.name}><span aria-hidden="true">📎</span><span>{message.file.name}<span className="chat-file-size">{Math.max(1, Math.ceil(message.file.size / 1024))} KB · Unduh file</span></span></a>}
                <div className="chat-message-footer"><time dateTime={message.sentAt} title={new Date(message.sentAt).toLocaleString('id-ID')}>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(message.sentAt))}</time>{message.own && <button type="button" aria-label={`Hapus pesan ${message.body || message.file.name}`} onClick={() => remove(message)}>Hapus</button>}</div>
            </div>)}
            <div ref={bottom} />
        </div>
        <form className="chat-composer" onSubmit={send}>
            {error && <p className="chat-error" role="alert">{error}</p>}
            {file && <div className="chat-attachment"><span>📎 {file.name}</span><button type="button" aria-label="Batalkan lampiran" onClick={clearAttachment}>×</button></div>}
            <label className="sr-only" htmlFor="chat-message">Tulis pesan</label>
            <textarea id="chat-message" rows="2" placeholder="Tulis pesan…" value={draft} maxLength={4000} onChange={event => setDraft(event.target.value)} />
            <div className="chat-composer-actions"><label className="chat-upload">📎 Lampirkan file<input ref={fileInput} type="file" aria-label="Lampirkan file" onChange={event => {
                const attachment = event.target.files?.[0];
                setError('');
                if (attachment && attachment.size > maxSize) { clearAttachment(); setError('Ukuran file maksimal 10 MB.'); return; }
                setFile(attachment ?? null);
            }} /></label><button className="chat-send" type="submit" disabled={!draft.trim() && !file}>Kirim pesan</button></div>
            <p className="chat-limit">Maks. 10 MB per file · 4.000 karakter per pesan</p>
        </form>
        <button className="chat-simulate" type="button" onClick={simulateReply}>Simulasikan balasan {selected.name}</button>
    </div>;
}
