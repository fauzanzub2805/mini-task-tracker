import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPicker } from './CalendarPicker.jsx';
import { ActivityTab, ProjectTabs, SettingsTab } from './ProjectDetail.jsx';
import {
    formatCommentStamp,
    formatFileSize,
    MAX_FILE_BYTES,
    notifyProjectsChanged,
    priorityKey,
    priorityLabel,
    priorityOptions,
    projectsApi,
    statusClass,
    statusLabel,
    STATUS_OPTIONS,
} from './projectsApi.js';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function CommentBody({ body, names }) {
    const pattern = useMemo(() => {
        const safe = names.filter(Boolean).map(escapeRegExp);
        return safe.length ? new RegExp(`(@(?:${safe.join('|')}))`, 'gi') : /(@[^\s]+)/g;
    }, [names]);

    return <div className="projects-comment-body">
        {String(body).split(pattern).map((part, index) => part.startsWith('@')
            ? <mark key={index} className="projects-mention">{part}</mark>
            : <span key={index}>{part}</span>)}
    </div>;
}

function PrioritySelect({ value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const current = options.find(option => String(option.id) === String(value));

    return <div className="projects-select">
        <button type="button" className={`projects-pill priority-${priorityKey(current)}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
            {priorityLabel(current)} <span aria-hidden="true">⌄</span>
        </button>
        {open && <ul className="projects-menu" role="listbox" aria-label="Priority">
            {options.map(option => <li key={option.name}>
                <button
                    type="button"
                    role="option"
                    aria-selected={String(option.id) === String(value)}
                    className={`priority-${option.name}`}
                    disabled={option.id === null}
                    title={option.id === null ? 'Prioritas belum tersedia di backend' : undefined}
                    onClick={() => { onChange(option.id); setOpen(false); }}
                >{priorityLabel(option)}{String(option.id) === String(value) && <span aria-hidden="true">✓</span>}</button>
            </li>)}
        </ul>}
    </div>;
}

function StatusSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);

    return <div className="projects-select">
        <button type="button" className={`projects-status-badge status-${statusClass(value)}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
            {statusLabel(value)} <span aria-hidden="true">›</span>
        </button>
        {open && <ul className="projects-menu" role="listbox" aria-label="Status">
            {STATUS_OPTIONS.map(option => <li key={option.value}>
                <button type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}>
                    <span className={`projects-status-badge status-${statusClass(option.value)}`}>{option.label}</span>
                    {option.value === value && <span aria-hidden="true">✓</span>}
                </button>
            </li>)}
        </ul>}
    </div>;
}

function AssigneePicker({ ids, members, canManage, onChange }) {
    const [open, setOpen] = useState(false);
    const assigned = members.filter(member => ids.includes(member.user_id));
    const candidates = members.filter(member => !ids.includes(member.user_id));
    const label = assigned.length ? assigned.map(member => member.user?.name).filter(Boolean).join(', ') : 'Unassigned';
    const short = label.length > 22 ? `${label.slice(0, 20)}...` : label;

    const toggle = userId => {
        if (!canManage) return;
        onChange(ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId]);
    };

    return <div className="projects-select projects-assignee">
        <button type="button" className="projects-pill projects-assignee-pill" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
            {short} <span aria-hidden="true">⌃</span>
        </button>
        {open && <div className="projects-assignee-menu" role="dialog" aria-label="Choose Assignee">
            <ul>
                {assigned.map(member => <li key={member.user_id}>
                    <button type="button" className="projects-assignee-option" disabled={!canManage} onClick={() => toggle(member.user_id)}>
                        <span className="projects-avatar" aria-hidden="true">{member.user?.name?.slice(0, 1)}</span>
                        {member.user?.name}
                        {canManage && <span className="projects-check" aria-hidden="true">✓</span>}
                    </button>
                </li>)}
                {assigned.length === 0 && <li className="projects-empty">Belum ada assignee.</li>}
            </ul>
            <hr />
            {canManage
                ? <>
                    <p className="projects-assignee-note">Add more staff for the task in this project:</p>
                    <ul>
                        {candidates.map(member => <li key={member.user_id}>
                            <button type="button" className="projects-assignee-option" aria-label={`Tambahkan ${member.user?.name}`} onClick={() => toggle(member.user_id)}>
                                <span className="projects-avatar" aria-hidden="true">{member.user?.name?.slice(0, 1)}</span>
                                {member.user?.name}
                                <span className="projects-add" aria-hidden="true">+</span>
                            </button>
                        </li>)}
                        {candidates.length === 0 && <li className="projects-empty">Semua anggota project sudah menjadi assignee.</li>}
                    </ul>
                </>
                : <p className="projects-assignee-note">Hanya Project Manager yang dapat mengubah assignee task ini.</p>}
        </div>}
    </div>;
}

function CommentsPanel({ taskId, members, dirtyRef, onChanged }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState('');
    const [mentionIds, setMentionIds] = useState([]);
    const [mentionQuery, setMentionQuery] = useState(null);
    const [sending, setSending] = useState(false);
    const inputRef = useRef(null);

    const load = useCallback(async signal => {
        try {
            const rows = await projectsApi.comments(taskId, { signal });
            setComments(rows);
            setError('');
        } catch (failure) {
            if (failure.name !== 'AbortError') setError(failure.message);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    useEffect(() => {
        let alive = true;
        const refresh = async () => {
            if (document.visibilityState === 'hidden' || dirtyRef.current) return;
            try {
                const rows = await projectsApi.comments(taskId);
                if (alive) setComments(rows);
            } catch {
                // Polling senyap: galat ditampilkan saat pengiriman manual.
            }
        };
        const timer = setInterval(refresh, 10000);
        window.addEventListener('focus', refresh);
        window.addEventListener('projects:changed', refresh);
        return () => {
            alive = false;
            clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('projects:changed', refresh);
        };
    }, [taskId, dirtyRef]);

    const suggestions = useMemo(() => {
        if (mentionQuery === null) return [];
        return members
            .filter(member => (member.user?.name ?? '').toLowerCase().includes(mentionQuery))
            .slice(0, 5);
    }, [members, mentionQuery]);

    function onDraftChange(event) {
        const value = event.target.value;
        setDraft(value);
        const at = value.lastIndexOf('@');
        setMentionQuery(at >= 0 && !/\s/.test(value.slice(at + 1)) ? value.slice(at + 1).toLowerCase() : null);
    }

    function pickMention(member) {
        const at = draft.lastIndexOf('@');
        const name = member.user?.name ?? '';
        setDraft(`${at >= 0 ? draft.slice(0, at) : draft}@${name} `);
        setMentionIds(ids => (ids.includes(member.user_id) ? ids : [...ids, member.user_id]));
        setMentionQuery(null);
        inputRef.current?.focus();
    }

    async function send(event) {
        event.preventDefault();
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true); setError('');
        try {
            await projectsApi.addComment(taskId, { body, mention_ids: mentionIds });
            setDraft(''); setMentionIds([]); setMentionQuery(null);
            await load();
            notifyProjectsChanged();
            onChanged?.();
        } catch (failure) {
            setError(failure.message);
        } finally {
            setSending(false);
        }
    }

    return <div className="projects-comments">
        {loading && <p className="projects-empty" role="status">Memuat komentar…</p>}
        {!loading && comments.length === 0 && <p className="projects-empty">Belum ada komentar.</p>}
        <ul className="projects-comment-list">
            {comments.map(comment => <li key={comment.id} className="projects-comment">
                <div className="projects-comment-bubble">
                    <div className="projects-comment-author">{comment.author?.name ?? 'Pengguna'}</div>
                    <CommentBody body={comment.body} names={members.map(member => member.user?.name).filter(Boolean)} />
                </div>
                <div className="projects-comment-meta">
                    <time dateTime={comment.created_at}>{formatCommentStamp(comment.created_at)}</time>
                </div>
            </li>)}
        </ul>

        <form className="projects-composer" onSubmit={send}>
            <div className="projects-composer-row">
                <div className="projects-composer-input">
                <textarea
                    ref={inputRef}
                    aria-label="Tulis komentar"
                    placeholder="Type here to make a comments..."
                    rows={1}
                    value={draft}
                    onChange={onDraftChange}
                />
                <button type="button" className="projects-composer-add" aria-label="Sisipkan mention" aria-expanded={mentionQuery !== null || suggestions.length > 0} onClick={() => { setMentionQuery(''); inputRef.current?.focus(); }}>+</button>
                </div>
                <button type="submit" className="projects-composer-send" aria-label="Kirim komentar" disabled={sending || !draft.trim()}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 3-6 18-4-8-8-4 18-6Z" /><path d="m11 13 10-10" /></svg>
                </button>
            </div>
            {suggestions.length > 0 && <ul className="projects-mention-menu" role="listbox" aria-label="Saran mention">
                {suggestions.map(member => <li key={member.user_id}>
                    <button type="button" role="option" aria-selected={false} onClick={() => pickMention(member)}>
                        <span className="projects-avatar" aria-hidden="true">{member.user?.name?.slice(0, 1)}</span>
                        {member.user?.name}
                    </button>
                </li>)}
            </ul>}
            {mentionIds.length > 0 && <p className="projects-composer-hint">{mentionIds.length} anggota akan di-mention.</p>}
            {error && <p className="projects-error" role="alert">{error}</p>}
        </form>
    </div>;
}

export function TaskDetail({ taskId, project, members, activities, priorities, user, canManage, navigate, onRefresh, dirtyRef }) {
    const [task, setTask] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', status: 'todo', priority_id: '', due_date: '', assignee_ids: [] });
    const [attachments, setAttachments] = useState([]);
    const [pending, setPending] = useState([]);
    const [fileError, setFileError] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('project-info');
    const localDirty = useRef(false);

    const options = useMemo(() => priorityOptions(priorities), [priorities]);
    // Tab activity task hanya menampilkan aktivitas yang terkait task ini.
    const taskActivities = useMemo(
        () => (activities ?? []).filter(activity => Number(activity.task_id) === Number(taskId)),
        [activities, taskId],
    );

    const applyTask = useCallback(fresh => {
        setTask(fresh);
        setForm({
            title: fresh.title ?? '',
            description: fresh.description ?? '',
            status: fresh.status ?? 'todo',
            priority_id: fresh.priority_id ?? fresh.priority?.id ?? '',
            due_date: fresh.due_date ?? '',
            assignee_ids: fresh.assignees?.length
                ? fresh.assignees.map(person => person.id)
                : fresh.assignee_id ? [fresh.assignee_id] : [],
        });
        setAttachments(fresh.attachments ?? []);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let alive = true;

        async function load() {
            // Draft tetap dipertahankan: data server selalu diambil, tetapi form
            // hanya diperbarui bila pengguna belum mengubah apa pun.
            try {
                const response = await projectsApi.task(taskId, { signal: controller.signal });
                if (!alive) return;
                const fresh = response?.data ?? response;
                if (!fresh) return;
                if (dirtyRef.current) {
                    setTask(fresh);
                    return;
                }
                applyTask(fresh);
                setError('');
            } catch (failure) {
                if (alive && failure.name !== 'AbortError') setError(failure.message);
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        const timer = setInterval(load, 10000);
        const onFocus = () => { setLoading(false); load(); };
        window.addEventListener('focus', onFocus);
        window.addEventListener('projects:changed', load);
        document.addEventListener('visibilitychange', load);
        return () => {
            alive = false;
            controller.abort();
            clearInterval(timer);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('projects:changed', load);
            document.removeEventListener('visibilitychange', load);
        };
    }, [taskId, applyTask, dirtyRef]);

    useEffect(() => {
        localDirty.current = false;
        dirtyRef.current = false;
        setPending([]); setFileError(''); setError(''); setNotice('');
        setTab('project-info');
    }, [taskId, dirtyRef]);

    function update(key, value) {
        localDirty.current = true;
        dirtyRef.current = true;
        setForm(current => ({ ...current, [key]: value }));
        setNotice('');
    }

    function onFiles(event) {
        const files = Array.from(event.target.files ?? []);
        const tooBig = files.filter(file => file.size > MAX_FILE_BYTES);
        setFileError(tooBig.length ? `${tooBig.map(file => file.name).join(', ')} melebihi batas 10 MB per file.` : '');
        const accepted = files.filter(file => file.size <= MAX_FILE_BYTES);
        if (accepted.length) {
            setPending(current => [...current, ...accepted]);
            localDirty.current = true;
            dirtyRef.current = true;
        }
        event.target.value = '';
    }

    async function removeAttachment(attachment) {
        setError('');
        try {
            await projectsApi.deleteAttachment(taskId, attachment.id);
            setAttachments(current => current.filter(item => item.id !== attachment.id));
            notifyProjectsChanged();
        } catch (failure) {
            setError(failure.status === 404 || failure.status === 405
                ? 'Penghapusan lampiran belum tersedia di server.'
                : failure.message);
        }
    }

    async function save(event) {
        event.preventDefault();
        if (!form.title.trim()) { setError('Title wajib diisi.'); setTab('project-info'); return; }
        setSaving(true); setError(''); setNotice('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description,
                status: form.status,
                due_date: form.due_date || null,
                assignee_id: form.assignee_ids[0] ?? null,
                assignee_ids: form.assignee_ids,
            };
            if (form.priority_id) payload.priority_id = Number(form.priority_id);
            const updated = await projectsApi.updateTask(taskId, payload);
            if (pending.length) await projectsApi.uploadAttachments(taskId, pending);
            setPending([]);
            localDirty.current = false;
            dirtyRef.current = false;
            const fresh = updated?.data ?? updated;
            if (fresh) applyTask(fresh);
            setNotice('Perubahan task disimpan.');
            notifyProjectsChanged();
            onRefresh?.();
        } catch (failure) {
            setError(failure.message);
        } finally {
            setSaving(false);
        }
    }

    function cancel() {
        localDirty.current = false;
        dirtyRef.current = false;
        setPending([]);
        setFileError('');
        setError('');
        setNotice('');
        if (task) applyTask(task);
        if (project) navigate(`/projects/${project.id}`);
    }

    const creator = task?.creator?.name ?? members.find(member => member.user_id === task?.created_by_id)?.user?.name ?? '—';
    const tabs = [
        { id: 'project-info', label: 'Project Info' },
        { id: 'comments', label: 'Comments' },
        { id: 'project-activity', label: 'Project Activity' },
        { id: 'project-setting', label: 'Project Setting' },
    ];

    return <>
        <ProjectTabs items={tabs} active={tab} onChange={setTab} label="Navigasi task" />
        <div className="projects-panel" id={`projects-panel-${tab}`} role="tabpanel" aria-labelledby={`projects-tab-${tab}`}>
            {tab === 'comments' && <CommentsPanel taskId={taskId} members={members} dirtyRef={dirtyRef} onChanged={onRefresh} />}
            {tab === 'project-activity' && <ActivityTab activities={taskActivities} emptyLabel="Belum ada aktivitas pada task ini." />}
            {tab === 'project-setting' && project && <SettingsTab project={project} members={members} canManage={canManage} navigate={navigate} onRefresh={onRefresh} />}
            {tab === 'project-info' && <>
                {loading && !task && <p className="projects-empty" role="status">Memuat task…</p>}
                <form className="projects-task-detail" onSubmit={save}>
                    <div className="projects-field">
                        <label className="projects-field-label" htmlFor="projects-detail-title">Title</label>
                        <div className="projects-field-body"><input id="projects-detail-title" value={form.title} maxLength={200} onChange={event => update('title', event.target.value)} /></div>
                    </div>

                    <div className="projects-grid-2">
                        <div className="projects-inline-field">
                            <span className="projects-inline-label">Created By</span>
                            <span className="projects-pill projects-pill-static">
                                {creator} <span className="projects-avatar" aria-hidden="true">{creator.slice(0, 1)}</span>
                            </span>
                        </div>
                        <div className="projects-inline-field">
                            <span className="projects-inline-label">Assignee</span>
                            <AssigneePicker ids={form.assignee_ids} members={members} canManage={canManage} onChange={value => update('assignee_ids', value)} />
                        </div>
                    </div>

                    <div className="projects-field">
                        <label className="projects-field-label" htmlFor="projects-detail-description">Description</label>
                        <div className="projects-field-body"><textarea id="projects-detail-description" rows={7} value={form.description} onChange={event => update('description', event.target.value)} /></div>
                    </div>

                    <div className="projects-grid-2">
                        <div className="projects-inline-field">
                            <span className="projects-inline-label">Priority</span>
                            <PrioritySelect value={form.priority_id} options={options} onChange={value => update('priority_id', value)} />
                        </div>
                        <div className="projects-inline-field">
                            <span className="projects-inline-label">Status</span>
                            <StatusSelect value={form.status} onChange={value => update('status', value)} />
                        </div>
                    </div>

                    <div className="projects-grid-2 projects-grid-top">
                        <section className="projects-due">
                            <div className="projects-inline-field">
                                <h3 className="projects-inline-label">Due Date</h3>
                                <span className="projects-pill projects-pill-static">{form.due_date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${form.due_date}T00:00:00`)) : 'Belum diatur'}</span>
                            </div>
                            <CalendarPicker value={form.due_date} onChange={value => update('due_date', value)} id="projects-detail-calendar" />
                        </section>

                        <section className="projects-files">
                            <h3>Files</h3>
                            <div className="projects-file-box">
                                <h4 className="projects-file-title">File upload</h4>
                                <div className="projects-file-row">
                                    <span>Attach file</span>
                                    <label className="projects-file-choose">
                                        Choose file
                                        <input type="file" multiple aria-label="Choose file" onChange={onFiles} />
                                    </label>
                                    <span className="projects-file-name">{pending.length ? pending.map(file => file.name).join(', ') : 'No file chosen'}</span>
                                </div>
                                <p className="projects-file-limit">Max 10 MB</p>
                                {fileError && <p className="projects-error" role="alert">{fileError}</p>}
                                {pending.length > 0 && <ul className="projects-file-list">
                                    {pending.map((file, index) => <li key={`${file.name}-${index}`}>
                                        <span>{file.name} <small>{formatFileSize(file.size)}</small></span>
                                        <button type="button" aria-label={`Hapus ${file.name}`} onClick={() => setPending(current => current.filter((_, i) => i !== index))}>×</button>
                                    </li>)}
                                </ul>}
                                {attachments.length > 0 && <ul className="projects-file-list projects-file-existing">
                                    {attachments.map(attachment => <li key={attachment.id}>
                                        <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a>
                                        <small>{formatFileSize(attachment.size)}</small>
                                        <button type="button" aria-label={`Hapus lampiran ${attachment.name}`} onClick={() => removeAttachment(attachment)}>×</button>
                                    </li>)}
                                </ul>}
                            </div>
                        </section>
                    </div>

                    {error && <p className="projects-error" role="alert">{error}</p>}
                    {notice && <p className="projects-notice" role="status">{notice}</p>}

                    <div className="projects-form-actions projects-form-actions-center">
                        <button type="submit" className="projects-primary" disabled={saving}>Save Changes</button>
                        <button type="button" className="projects-secondary" disabled={saving} onClick={cancel}>Cancel</button>
                    </div>
                </form>
            </>}
        </div>
    </>;
}
