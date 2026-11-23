import { useCallback, useEffect, useState } from 'react';
import '../projects/projectsApi.js'; // meneruskan perubahan dari tab lain sebagai event 'projects:changed'

const statusNames = { todo: 'Open Task', in_progress: 'In Progress', finish_dev: 'Finish Dev', testing: 'Testing', done: 'Finished' };
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
const names = people => (people ?? []).map(person => person?.name).filter(Boolean).join(', ');
const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Jeda polling. Selama data belum berubah server menjawab 304 tanpa body,
// jadi interval rapat ini tetap ringan.
export const MONITORING_POLL_MS = 3000;

/** Satu permintaan = satu snapshot: angka ringkasan dan daftar task selalu selaras. */
async function fetchMonitoring(etag, signal) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    if (etag) headers['If-None-Match'] = etag;
    const response = await fetch('/dashboard/monitoring', { credentials: 'same-origin', cache: 'no-store', headers, signal });
    if (response.status === 304) return null;
    if (!response.ok) {
        throw new Error([401, 419].includes(response.status) ? 'Sesi berakhir. Silakan login kembali.' : 'Data monitoring belum dapat dimuat.');
    }
    const body = await response.json();
    return { etag: response.headers?.get?.('ETag') ?? null, summary: body?.summary ?? {}, rows: body?.data ?? [] };
}

export function ProjectMonitoring({ userId }) {
    const [snapshot, setSnapshot] = useState({ summary: {}, rows: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [syncedAt, setSyncedAt] = useState(null);
    const [revision, setRevision] = useState(0);
    const retry = useCallback(() => setRevision(value => value + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        let running = false;
        let queued = false;
        let etag = null;

        async function load(mustRun = false) {
            if (document.visibilityState === 'hidden') return;
            if (running) {
                // Perubahan yang datang saat permintaan masih berjalan tidak boleh
                // hilang: jalankan sekali lagi begitu permintaan itu selesai.
                if (mustRun) queued = true;
                return;
            }
            running = true;
            try {
                const result = await fetchMonitoring(etag, controller.signal);
                if (controller.signal.aborted) return;
                if (result) {
                    etag = result.etag;
                    setSnapshot({ summary: result.summary, rows: result.rows });
                }
                setError('');
                setSyncedAt(new Date());
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure.message);
            } finally {
                running = false;
                if (!controller.signal.aborted) {
                    setLoading(false);
                    if (queued) {
                        queued = false;
                        load();
                    }
                }
            }
        }

        const refresh = () => load(true);
        load();
        const timer = setInterval(load, MONITORING_POLL_MS);
        window.addEventListener('focus', refresh);
        window.addEventListener('projects:changed', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            controller.abort();
            clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('projects:changed', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [userId, revision]);

    const { summary, rows } = snapshot;

    return <section id="progress-table" className="dashboard-progress" aria-labelledby="progress-title">
        <h2 className="sr-only" id="progress-title">Progress Table</h2>
        <div className="dashboard-stats">{Object.entries(statusNames).map(([key, name]) => <div key={key} className={`dashboard-stat ${statusClass(name)}`}><span>{name}</span><strong>{summary[key] ?? 0}</strong></div>)}</div>
        <div className="dashboard-table-card">
            <h3>On going Projects &amp; Tasks</h3>
            <p className="dashboard-table-note">
                <span className={`dashboard-live${error ? ' is-offline' : ''}`} aria-hidden="true" />
                Data project dari database · {error ? 'Sinkronisasi terputus' : 'Tersinkron otomatis'}
                {syncedAt && <> · Terakhir diperbarui <time dateTime={syncedAt.toISOString()}>{clock.format(syncedAt)}</time></>}
            </p>
            {error && <p role="alert">{error} <button onClick={retry}>Coba lagi</button></p>}
            {loading && <p role="status">Memuat project dan task…</p>}
            <div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Tabel progress, geser horizontal pada layar kecil">
                <table><caption className="sr-only">Project dan task yang dapat Anda akses</caption>
                    <thead><tr>{['Task', 'Project', 'Assignee', 'PM', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                    <tbody>{rows.map(task => {
                        const status = statusNames[task.status] ?? task.status;
                        return <tr key={task.id}>
                            {/* Warna titik mengikuti project, jadi tidak berganti saat urutan baris berubah. */}
                            <td><a className="dashboard-task" href={`/projects/${task.project.id}/tasks/${task.id}`}><span className={`task-dot task-dot-${task.project.id % 5}`} aria-hidden="true">{task.project.name.trim().slice(0, 1)}</span>{task.title}</a></td>
                            <td><a href={`/projects/${task.project.id}`}>{task.project.name}</a></td>
                            <td>{names(task.assignees) || 'Unassigned'}</td>
                            <td>{names(task.managers) || '—'}</td><td><span className={`dashboard-badge ${statusClass(status)}`}>{status}</span></td>
                        </tr>;
                    })}{!loading && !error && rows.length === 0 && <tr><td colSpan={5}>Belum ada task. <a href="/projects">Buka Projects</a></td></tr>}</tbody>
                </table>
            </div>
        </div>
    </section>;
}
