import { useCallback, useEffect, useMemo, useState } from 'react';
import { initials } from '../../lib/format.js';
import { DEFAULT_TASK_FILTERS, filterTasks, TaskFilters } from '../projects/TaskFilters.jsx';
import { notifyProjectsChanged, priorityKey, priorityLabel, projectsApi, statusLabel } from '../projects/projectsApi.js';

// Kolom Kanban mengikuti urutan status Figma: Open Task → Finished.
export const KANBAN_COLUMNS = [
    { status: 'todo', label: 'Open Task', tone: 'open' },
    { status: 'in_progress', label: 'In Progress', tone: 'progress' },
    { status: 'finish_dev', label: 'Finish Dev', tone: 'finish-dev' },
    { status: 'testing', label: 'Testing', tone: 'testing' },
    { status: 'done', label: 'Finished', tone: 'finished' },
];

function CommentIcon() {
    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-4.6A7.5 7.5 0 0 1 8.5 4h4A7.5 7.5 0 0 1 20 11.5Z" />
    </svg>;
}

function TaskCard({ task, dragging, onDragStart, onDragEnd }) {
    const creator = task.creator?.name ?? '';
    const count = task.comments_count ?? 0;

    return <article
        className={`kanban-card${dragging ? ' is-dragging' : ''}`}
        draggable
        onDragStart={event => onDragStart(event, task)}
        onDragEnd={onDragEnd}
        aria-label={`Task ${task.title}`}
    >
        <h3>{task.title}</h3>
        <div className="kanban-card-meta">
            <span className={`projects-priority-pill priority-${priorityKey(task.priority)}`}>{priorityLabel(task.priority)}</span>
            <span className="kanban-card-spacer" />
            <span className="kanban-comments" aria-label={`${count} komentar`}>
                <CommentIcon /><span aria-hidden="true">{count}</span>
            </span>
            <span className="kanban-avatar" title={creator || 'Pembuat task'} aria-hidden="true">{initials(creator) || '?'}</span>
        </div>
    </article>;
}

/**
 * Kanban Board: seluruh task dari semua project yang terlihat user, dikelompokkan
 * per status. Kartu bisa diseret ke kolom status lain; perubahan disimpan lewat
 * endpoint update task yang sudah ada.
 */
export function KanbanBoard({ user = null }) {
    const [projects, setProjects] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [users, setUsers] = useState([]);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
    const [draggingId, setDraggingId] = useState(null);
    const [overStatus, setOverStatus] = useState(null);

    const load = useCallback(async signal => {
        try {
            const [projectRows, priorityResponse, userRows] = await Promise.all([
                projectsApi.list({ signal }),
                projectsApi.priorities({ signal }).catch(() => ({ data: [] })),
                projectsApi.users({ signal }).catch(() => []),
            ]);
            if (signal?.aborted) return;
            setProjects(projectRows);
            setPriorities(priorityResponse?.data ?? priorityResponse ?? []);
            setUsers(userRows);

            const groups = await Promise.all(projectRows.map(async project => (await projectsApi.tasks(project.id, { signal }))
                .map(task => ({ ...task, project }))));
            if (signal?.aborted) return;
            setRows(groups.flat());
            setError('');
        } catch (failure) {
            if (failure.name !== 'AbortError' && !signal?.aborted) setError(failure.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
        const timer = setInterval(refresh, 10000);
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
    }, [load]);

    // Bar tanpa "Any Status" (status sudah diwakili kolom Kanban).
    const visibleRows = useMemo(
        () => filterTasks(rows, { ...filters, status: null }, user?.id ?? null, ''),
        [rows, filters, user],
    );

    const byStatus = useMemo(() => KANBAN_COLUMNS.reduce((groups, column) => {
        groups[column.status] = visibleRows.filter(task => task.status === column.status);
        return groups;
    }, {}), [visibleRows]);

    function onDragStart(event, task) {
        setDraggingId(task.id);
        event.dataTransfer?.setData('text/plain', String(task.id));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }

    function onDragEnd() {
        setDraggingId(null);
        setOverStatus(null);
    }

    async function moveTask(task, status) {
        if (!task || task.status === status) return;
        const previous = task.status;
        // Optimistis: kartu langsung pindah kolom, dikembalikan bila server menolak.
        setRows(current => current.map(row => (row.id === task.id ? { ...row, status } : row)));
        setError('');
        try {
            await projectsApi.updateTask(task.id, { status });
            notifyProjectsChanged();
        } catch (failure) {
            setRows(current => current.map(row => (row.id === task.id ? { ...row, status: previous } : row)));
            setError(failure.message);
        }
    }

    function onDrop(event, status) {
        event.preventDefault();
        const id = Number(event.dataTransfer?.getData('text/plain')) || draggingId;
        setDraggingId(null);
        setOverStatus(null);
        moveTask(rows.find(task => task.id === id), status);
    }

    return <div className="kanban-page">
        <div className="kanban-heading">
            <h1>Kanban Board : Task Status Monitoring</h1>
        </div>

        <TaskFilters
            filters={filters}
            onChange={setFilters}
            projects={projects}
            priorities={priorities}
            users={users}
            showStatus={false}
        />

        {loading && <p className="projects-empty" role="status">Memuat task…</p>}
        {error && <p className="projects-error" role="alert">{error}</p>}

        <div className="kanban-scroll">
            <div className="kanban-board">
                {KANBAN_COLUMNS.map(column => {
                    const cards = byStatus[column.status] ?? [];
                    return <section
                        key={column.status}
                        className={`kanban-column tone-${column.tone}${overStatus === column.status ? ' is-over' : ''}`}
                        aria-label={`${column.label}, ${cards.length} task`}
                        onDragOver={event => {
                            event.preventDefault();
                            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
                            if (overStatus !== column.status) setOverStatus(column.status);
                        }}
                        onDragLeave={event => {
                            if (!event.currentTarget.contains(event.relatedTarget)) setOverStatus(null);
                        }}
                        onDrop={event => onDrop(event, column.status)}
                    >
                        <header className="kanban-column-head">
                            <span className="kanban-dot" aria-hidden="true" />
                            <h2>{statusLabel(column.status) || column.label}</h2>
                            <span className="kanban-count">{cards.length}</span>
                        </header>
                        <div className="kanban-column-body">
                            {cards.map(task => <TaskCard
                                key={task.id}
                                task={task}
                                dragging={draggingId === task.id}
                                onDragStart={onDragStart}
                                onDragEnd={onDragEnd}
                            />)}
                            {cards.length === 0 && <p className="kanban-empty">Belum ada task.</p>}
                        </div>
                    </section>;
                })}
            </div>
        </div>
    </div>;
}

export default KanbanBoard;
