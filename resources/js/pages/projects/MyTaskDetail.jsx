import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    formatDay,
    formatFileSize,
    MAX_FILE_BYTES,
    notifyProjectsChanged,
    priorityKey,
    priorityLabel,
    projectsApi,
    statusClass,
    statusLabel,
} from './projectsApi.js';

// Tab filter mengikuti desain Figma. Untuk saat ini hanya tampilan (penyaringan
// sebenarnya ada di halaman Tasks); "Assigned to me" ditandai aktif.
const FILTER_TABS = ['Assigned to me', 'Created by', 'All Projects', 'Any Priority', 'Any Status', 'Assigned to'];

const RASTER_MIME = /^image\//i;

function isImageAttachment(file) {
    return RASTER_MIME.test(file?.mime_type || '');
}

/**
 * Halaman "My Tasks → {judul}". Muncul saat pengguna mengklik salah satu task
 * pada tabel All Tasks. Fokusnya melihat task yang ditugaskan dan mengumpulkan
 * berkas: "Given Files" berasal dari Instructions File project, dan "Submit File"
 * menambah Submitted Files yang terlihat di halaman detail task project.
 */
export function MyTaskDetail({ taskId, project, navigate }) {
    const [task, setTask] = useState(null);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fileError, setFileError] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async signal => {
        try {
            const response = await projectsApi.task(taskId, { signal });
            const fresh = response?.data ?? response;
            if (fresh) { setTask(fresh); setError(''); }
        } catch (failure) {
            if (failure.name !== 'AbortError') setError(failure.message);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        const refresh = () => load();
        window.addEventListener('focus', refresh);
        window.addEventListener('projects:changed', refresh);
        return () => {
            controller.abort();
            window.removeEventListener('focus', refresh);
            window.removeEventListener('projects:changed', refresh);
        };
    }, [load]);

    // Given Files = berkas instruksi (sama dengan Instructions File di project).
    const givenFiles = useMemo(
        () => (task?.attachments ?? []).filter(item => (item.kind ?? 'instruction') !== 'submission'),
        [task],
    );
    const hero = useMemo(() => givenFiles.find(isImageAttachment) ?? null, [givenFiles]);

    const projectName = task?.project?.name ?? project?.name ?? '—';

    function onFiles(event) {
        const files = Array.from(event.target.files ?? []);
        const tooBig = files.filter(file => file.size > MAX_FILE_BYTES);
        setFileError(tooBig.length ? `${tooBig.map(file => file.name).join(', ')} melebihi batas 10 MB per file.` : '');
        const accepted = files.filter(file => file.size <= MAX_FILE_BYTES);
        if (accepted.length) setPending(current => [...current, ...accepted]);
        event.target.value = '';
    }

    function removePending(index) {
        setPending(current => current.filter((_, i) => i !== index));
    }

    async function submit(event) {
        event.preventDefault();
        if (!pending.length) { setFileError('Pilih minimal satu file untuk dikumpulkan.'); return; }
        setSubmitting(true); setError(''); setNotice('');
        try {
            await projectsApi.uploadAttachments(taskId, pending, 'submission');
            setPending([]);
            setNotice('Berkas berhasil dikumpulkan.');
            notifyProjectsChanged();
            await load();
        } catch (failure) {
            setError(failure.message);
        } finally {
            setSubmitting(false);
        }
    }

    function cancel() {
        setPending([]); setFileError(''); setError(''); setNotice('');
        navigate('/projects?view=tasks');
    }

    function onSearch(event) {
        event.preventDefault();
        const term = search.trim();
        navigate(term ? `/projects?view=tasks&q=${encodeURIComponent(term)}` : '/projects?view=tasks');
    }

    return <div className="mytask-page">
        <div className="mytask-toolbar">
            <form className="mytask-search" role="search" onSubmit={onSearch}>
                <input
                    type="search"
                    aria-label="Find a task"
                    placeholder="Find a task.."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                />
                <button type="submit" aria-label="Cari task">⌕</button>
            </form>
            <div className="mytask-filters" role="group" aria-label="Filter task">
                {FILTER_TABS.map((label, index) => <button
                    key={label}
                    type="button"
                    className={index === 0 ? 'is-active' : undefined}
                    aria-pressed={index === 0}
                    title="Penyaringan tersedia di halaman Tasks"
                    onClick={() => navigate('/projects?view=tasks')}
                >{label}{index > 0 && index < 5 ? ' ›' : ''}</button>)}
            </div>
        </div>

        {loading && !task && <p className="projects-empty" role="status">Memuat task…</p>}

        {task && <div className="mytask-card">
            <h2>{task.title}</h2>

            <div className="mytask-top">
                <div className="mytask-hero">
                    {hero
                        ? <img src={hero.preview_url || hero.url} alt={`Pratinjau ${hero.name}`} loading="lazy" />
                        : <div className="mytask-hero-empty">Tidak ada gambar</div>}
                </div>
                <div className="mytask-side">
                    <div className="mytask-field">
                        <span>Project</span>
                        <span className="mytask-pill mytask-pill-plain">{projectName}</span>
                    </div>
                    <div className="mytask-field">
                        <span>Priority</span>
                        <span className="mytask-pill">
                            <span className={`projects-priority-pill priority-${priorityKey(task.priority)}`}>{priorityLabel(task.priority)}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="mytask-block">
                <h3>Task Description</h3>
                <div className="mytask-readonly">{task.description || 'Tidak ada deskripsi.'}</div>
            </div>

            <div className="mytask-grid">
                <section>
                    <div className="mytask-block" style={{ marginBottom: 0 }}>
                        <h3>Given Files</h3>
                        <div className="mytask-given">
                            {givenFiles.length === 0
                                ? <p className="mytask-given-empty">No file attached</p>
                                : <ul className="mytask-given-list">
                                    {givenFiles.map(file => <li key={file.id}>
                                        <a href={file.url} target="_blank" rel="noopener noreferrer">{file.name}</a>
                                        <small>{formatFileSize(file.size)}</small>
                                    </li>)}
                                </ul>}
                        </div>
                    </div>
                </section>
                <section className="mytask-side">
                    <div className="mytask-field">
                        <span>Due Date</span>
                        <span className="mytask-pill mytask-pill-date">{task.due_date ? formatDay(task.due_date) : 'Belum diatur'}</span>
                    </div>
                    <div className="mytask-field">
                        <span>Status</span>
                        <span className="mytask-pill">
                            <span className={`projects-status-badge status-${statusClass(task.status)}`}>{statusLabel(task.status)}</span>
                        </span>
                    </div>
                </section>
            </div>

            <form className="mytask-block" onSubmit={submit}>
                <h3>Submit File</h3>
                <div className="mytask-submit">
                    <div className="projects-file-box">
                        <h4 className="projects-file-title">File upload</h4>
                        <div className="projects-file-row">
                            <span>Attach file</span>
                            <label className="projects-file-choose">
                                Choose file
                                <input type="file" multiple aria-label="Choose file" disabled={submitting} onChange={onFiles} />
                            </label>
                            <span className="projects-file-name">{pending.length ? pending.map(file => file.name).join(', ') : 'No file chosen'}</span>
                        </div>
                        <p className="projects-file-limit">Max 10 MB</p>
                        {fileError && <p className="projects-error" role="alert">{fileError}</p>}
                        {pending.length > 0 && <ul className="projects-file-list">
                            {pending.map((file, index) => <li key={`${file.name}-${index}`}>
                                <span>{file.name} <small>{formatFileSize(file.size)}</small></span>
                                <button type="button" aria-label={`Hapus ${file.name}`} disabled={submitting} onClick={() => removePending(index)}>×</button>
                            </li>)}
                        </ul>}
                    </div>
                </div>

                {error && <p className="projects-error" role="alert">{error}</p>}
                {notice && <p className="projects-notice" role="status">{notice}</p>}

                <div className="mytask-actions">
                    <button type="submit" className="projects-primary" disabled={submitting}>Save Submitted Files</button>
                    <button type="button" className="projects-secondary" disabled={submitting} onClick={cancel}>Cancel</button>
                </div>
            </form>
        </div>}
    </div>;
}

export default MyTaskDetail;
