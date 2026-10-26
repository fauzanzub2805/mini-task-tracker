import { useCallback, useEffect, useState } from 'react';

const statusNames = { todo: 'Open Task', in_progress: 'In Progress', finish_dev: 'Finish Dev', testing: 'Testing', done: 'Finished' };
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');

async function allPages(path, signal) {
    const rows = [];
    let next = path;
    while (next) {
        const response = await fetch(next, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Sesi berakhir. Silakan login kembali.' : 'Data monitoring belum dapat dimuat.');
        const body = await response.json();
        rows.push(...(body.data ?? []));
        next = body.links?.next ?? null;
    }
    return rows;
}

export function ProjectMonitoring({ userId }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const retry = useCallback(() => setRevision(value => value + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        let pending = false;
        async function load() {
            if (pending || document.visibilityState === 'hidden') return;
            pending = true;
            try {
                const projects = await allPages('/projects', controller.signal);
                const groups = await Promise.all(projects.map(async project => {
                    const [tasks, members] = await Promise.all([
                        allPages(`/projects/${project.id}/tasks`, controller.signal),
                        allPages(`/projects/${project.id}/members`, controller.signal),
                    ]);
                    const managers = members.filter(member => member.role?.name === 'manager').map(member => member.user?.name).filter(Boolean).join(', ') || '—';
                    return tasks.map(task => ({ ...task, project, managers }));
                }));
                if (!controller.signal.aborted) {
                    setRows(groups.flat());
                    setError('');
                }
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure.message);
            } finally {
                pending = false;
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        load();
        const timer = setInterval(load, 10000);
        window.addEventListener('focus', load);
        window.addEventListener('projects:changed', load);
        document.addEventListener('visibilitychange', load);
        return () => {
            controller.abort();
            clearInterval(timer);
            window.removeEventListener('focus', load);
            window.removeEventListener('projects:changed', load);
            document.removeEventListener('visibilitychange', load);
        };
    }, [userId, revision]);

    return <section id="progress-table" className="dashboard-progress" aria-labelledby="progress-title">
        <h2 className="sr-only" id="progress-title">Progress Table</h2>
        <div className="dashboard-stats">{Object.entries(statusNames).map(([key, name]) => <div key={key} className={`dashboard-stat ${statusClass(name)}`}><span>{name}</span><strong>{rows.filter(row => row.status === key).length}</strong></div>)}</div>
        <div className="dashboard-table-card">
            <h3>On going Projects &amp; Tasks</h3>
            <p className="dashboard-table-note">Data project dari database · Diperbarui otomatis setiap 10 detik.</p>
            {error && <p role="alert">{error} <button onClick={retry}>Coba lagi</button></p>}
            {loading && <p role="status">Memuat project dan task…</p>}
            <div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Tabel progress, geser horizontal pada layar kecil">
                <table><caption className="sr-only">Project dan task yang dapat Anda akses</caption>
                    <thead><tr>{['Task', 'Project', 'Assignee', 'PM', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                    <tbody>{rows.map((task, index) => {
                        const status = statusNames[task.status] ?? task.status;
                        const assignees = task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [];
                        return <tr key={task.id}>
                            <td><a className="dashboard-task" href={`/projects/${task.project.id}/tasks/${task.id}`}><span className={`task-dot task-dot-${index % 5}`} aria-hidden="true">{task.project.name.slice(0, 1)}</span>{task.title}</a></td>
                            <td><a href={`/projects/${task.project.id}`}>{task.project.name}</a></td>
                            <td>{assignees.map(person => person.name).join(', ') || 'Unassigned'}</td>
                            <td>{task.managers}</td><td><span className={`dashboard-badge ${statusClass(status)}`}>{status}</span></td>
                        </tr>;
                    })}{!loading && !error && rows.length === 0 && <tr><td colSpan={5}>Belum ada task. <a href="/projects">Buka Projects</a></td></tr>}</tbody>
                </table>
            </div>
        </div>
    </section>;
}
