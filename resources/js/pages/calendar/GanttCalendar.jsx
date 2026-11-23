import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterMenu, OptionList } from '../projects/TaskFilters.jsx';
import { parseISODate, priorityLabel, projectsApi, statusLabel, STATUS_OPTIONS } from '../projects/projectsApi.js';

const DAY_MS = 86400000;
// Lebar minimum linimasa agar chart tetap mengisi kartu pada rentang pendek.
const MIN_TIMELINE_WIDTH = 1100;

export const GANTT_SCALES = {
    day: { label: 'Day', width: 34, before: 3, after: 8 },
    week: { label: 'Week', width: 14, before: 7, after: 21 },
    month: { label: 'Month', width: 5, before: 15, after: 50 },
};

// Warna bar task mengikuti status yang sama dengan kolom Kanban.
const STATUS_TONES = { todo: 'open', in_progress: 'progress', finish_dev: 'finish-dev', testing: 'testing', done: 'finished' };

/** Tanggal lokal (tanpa jam) dari "YYYY-MM-DD" maupun timestamp ISO. */
export function toDay(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseISODate(text);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Nomor hari berurutan; selisihnya aman dari pergantian zona waktu/DST. */
export function dayNumber(date) {
    return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function dateOfDay(number) {
    const utc = new Date(number * DAY_MS);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

const numberOf = value => {
    const day = toDay(value);
    return day ? dayNumber(day) : null;
};

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

// Deadline terdekat lebih dulu; baris tanpa deadline diletakkan paling bawah.
function byDeadline(a, b) {
    if (a.end === null && b.end === null) return a.name.localeCompare(b.name);
    if (a.end === null) return 1;
    if (b.end === null) return -1;
    return a.end - b.end || (a.start ?? 0) - (b.start ?? 0) || a.name.localeCompare(b.name);
}

function taskAssignees(task) {
    const people = task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [];
    return people.map(person => person?.name).filter(Boolean);
}

/**
 * Satu baris per project. Tabel projects tidak punya kolom deadline, jadi
 * deadline project = due date task terakhirnya (sama dengan "Project Deadline"
 * di halaman detail project). Bar dimulai sejak project dibuat.
 */
export function projectRows(projects, tasksByProject, today = new Date()) {
    const todayNumber = dayNumber(today);
    return projects.map(project => {
        const tasks = tasksByProject[project.id] ?? [];
        const dues = tasks.map(task => numberOf(task.due_date)).filter(value => value !== null);
        const starts = [numberOf(project.created_at), ...tasks.map(task => numberOf(task.created_at))].filter(value => value !== null);
        const end = dues.length ? Math.max(...dues) : null;
        let start = starts.length ? Math.min(...starts) : end;
        if (start !== null && end !== null && start > end) start = end;
        const done = tasks.filter(task => task.status === 'done').length;
        const progress = tasks.length ? done / tasks.length : 0;
        return {
            id: project.id,
            name: project.name ?? '',
            tone: 'project',
            start,
            end,
            done,
            total: tasks.length,
            progress,
            overdue: end !== null && end < todayNumber && progress < 1,
        };
    }).sort(byDeadline);
}

/** Satu baris per task: bar dari tanggal task dibuat sampai due date-nya. */
export function taskRows(tasks, today = new Date()) {
    const todayNumber = dayNumber(today);
    return tasks.map(task => {
        const end = numberOf(task.due_date);
        let start = numberOf(task.created_at) ?? end;
        if (start !== null && end !== null && start > end) start = end;
        return {
            id: task.id,
            projectId: task.project_id,
            name: task.title ?? '',
            tone: STATUS_TONES[task.status] ?? 'open',
            status: task.status,
            priority: task.priority,
            assignees: taskAssignees(task),
            start,
            end,
            progress: null,
            overdue: end !== null && end < todayNumber && task.status !== 'done',
        };
    }).sort(byDeadline);
}

/** Rentang, lebar hari, dan garis bantu linimasa untuk kumpulan baris. */
export function buildTimeline(rows, today = new Date(), scale = 'auto') {
    const todayNumber = dayNumber(today);
    const numbers = rows.flatMap(row => [row.start, row.end]).filter(value => value !== null);
    let first = Math.min(todayNumber, ...numbers);
    let last = Math.max(todayNumber, ...numbers);
    const span = last - first + 1;
    const key = GANTT_SCALES[scale] ? scale : span <= 62 ? 'day' : span <= 240 ? 'week' : 'month';
    const { width: dayWidth, before, after } = GANTT_SCALES[key];

    // Ruang di kanan dipakai label tanggal deadline setelah bar.
    first -= before;
    last += after;
    const minimumDays = Math.ceil(MIN_TIMELINE_WIDTH / dayWidth);
    if (last - first + 1 < minimumDays) last = first + minimumDays - 1;

    const months = [];
    const ticks = [];
    for (let number = first; number <= last; number += 1) {
        const date = dateOfDay(number);
        const offset = number - first;
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const current = months[months.length - 1];
        if (current?.key === monthKey) current.days += 1;
        else months.push({ key: monthKey, label: monthName.format(date), offset, days: 1 });

        const weekday = date.getDay();
        if (key === 'day') ticks.push({ offset, span: 1, label: date.getDate(), weekend: weekday === 0 || weekday === 6, today: number === todayNumber });
        else if (key === 'week' && weekday === 1) ticks.push({ offset, span: 7, label: date.getDate() });
        else if (key === 'month' && date.getDate() === 1) ticks.push({ offset, span: 0, label: '' });
    }

    return { scale: key, dayWidth, first, last, days: last - first + 1, width: (last - first + 1) * dayWidth, months, ticks, todayOffset: todayNumber - first };
}

function readView() {
    const params = new URLSearchParams(window.location.search);
    const project = Number(params.get('project'));
    return {
        mode: params.get('view') === 'tasks' ? 'tasks' : 'projects',
        projectId: Number.isInteger(project) && project > 0 ? project : null,
    };
}

// Menyimpan pilihan di URL agar reload dan tombol Back kembali ke tampilan yang sama.
function writeView(view) {
    if (window.location.pathname !== '/calendar' || !window.history?.replaceState) return;
    const query = view.mode === 'tasks' ? `?view=tasks${view.projectId ? `&project=${view.projectId}` : ''}` : '';
    if (`${window.location.pathname}${window.location.search}` !== `/calendar${query}`) window.history.replaceState({}, '', `/calendar${query}`);
}

function rangeText(row) {
    if (row.end === null) return 'belum ada deadline';
    return `${longDate.format(dateOfDay(row.start))} sampai ${longDate.format(dateOfDay(row.end))}`;
}

function GanttRow({ row, mode, timeline, onOpen }) {
    const { dayWidth, first, todayOffset } = timeline;
    const dated = row.end !== null;
    const left = ((row.start ?? first + todayOffset) - first) * dayWidth;
    const width = dated ? (row.end - row.start + 1) * dayWidth : 0;
    const percent = Math.round((row.progress ?? 0) * 100);

    const meta = mode === 'projects'
        ? (row.total ? `${row.done}/${row.total} task selesai` : 'Belum ada task')
        : [statusLabel(row.status), row.assignees.join(', ') || 'Unassigned'].filter(Boolean).join(' · ');
    const label = mode === 'projects'
        ? `Project ${row.name}, ${rangeText(row)}, ${row.total ? `${row.done} dari ${row.total} task selesai` : 'belum ada task'}${row.overdue ? ', melewati deadline' : ''}`
        : `Task ${row.name}, ${rangeText(row)}, ${statusLabel(row.status)}${row.overdue ? ', melewati deadline' : ''}`;
    const tooltip = dated
        ? `${row.name}\n${shortDate.format(dateOfDay(row.start))} – ${shortDate.format(dateOfDay(row.end))}`
        : row.name;

    return <div className={`gantt-row gantt-tone-${row.tone}${row.overdue ? ' is-overdue' : ''}`} role="listitem">
        <div className="gantt-label">
            <button type="button" className="gantt-row-button" aria-label={label} onClick={() => onOpen(row)}>
                <strong>{row.name}</strong>
                <small>{meta}</small>
            </button>
        </div>
        <div className="gantt-track" style={{ width: timeline.width }}>
            {dated && <>
                {/* Bar hanya pintasan klik; nama dan rentang dibacakan lewat tombol baris. */}
                <div className="gantt-bar" style={{ left, width }} title={tooltip} aria-hidden="true" onClick={() => onOpen(row)}>
                    {row.progress !== null && <span className="gantt-bar-fill" style={{ width: `${percent}%` }} />}
                </div>
                <span className="gantt-bar-note" style={{ left: left + width }}>
                    {shortDate.format(dateOfDay(row.end))}
                    {row.progress !== null && row.total > 0 && ` · ${percent}%`}
                    {mode === 'tasks' && row.priority?.name && ` · ${priorityLabel(row.priority)}`}
                    {row.overdue && <em className="gantt-overdue">Overdue</em>}
                </span>
            </>}
            {!dated && <span className="gantt-undated" style={{ left }}>{mode === 'projects' ? 'Belum ada deadline' : 'Belum ada due date'}</span>}
        </div>
    </div>;
}

/**
 * Calendar: Gantt chart dengan dua tampilan.
 * - Project Deadlines: satu bar per project sampai deadline-nya.
 * - Task Timeline: bar tiap task dari satu project sampai due date-nya.
 */
export function GanttCalendar() {
    const [projects, setProjects] = useState([]);
    const [tasksByProject, setTasksByProject] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState(readView);
    const [scale, setScale] = useState('auto');
    const [menu, setMenu] = useState(null);
    const barRef = useRef(null);
    const scrollRef = useRef(null);

    const load = useCallback(async signal => {
        try {
            const projectRowsData = await projectsApi.list({ signal });
            const groups = await Promise.all(projectRowsData.map(async project => [project.id, await projectsApi.tasks(project.id, { signal })]));
            if (signal?.aborted) return;
            setProjects(projectRowsData);
            setTasksByProject(Object.fromEntries(groups));
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
        const refresh = () => { if (document.visibilityState !== 'hidden') load(controller.signal); };
        const timer = setInterval(refresh, 30000);
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

    // Link sidebar dan tombol Back mengubah URL tanpa memasang ulang komponen.
    useEffect(() => {
        const sync = () => { if (window.location.pathname === '/calendar') setView(readView()); };
        window.addEventListener('popstate', sync);
        window.addEventListener('app:navigate', sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener('app:navigate', sync);
        };
    }, []);

    useEffect(() => {
        if (!menu) return undefined;
        const close = event => { if (!barRef.current?.contains(event.target)) setMenu(null); };
        const escape = event => { if (event.key === 'Escape') setMenu(null); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escape);
        };
    }, [menu]);

    const todayKey = new Date().toDateString();
    const today = useMemo(() => toDay(new Date()), [todayKey]);
    const projectList = useMemo(() => projectRows(projects, tasksByProject, today), [projects, tasksByProject, today]);

    const { mode } = view;
    // Tanpa pilihan eksplisit, Task Timeline membuka project dengan deadline terdekat.
    const activeProject = mode === 'tasks'
        ? (projects.find(project => project.id === view.projectId) ?? projects.find(project => project.id === projectList[0]?.id) ?? null)
        : null;
    const rows = useMemo(
        () => (mode === 'projects' ? projectList : taskRows(tasksByProject[activeProject?.id] ?? [], today)),
        [mode, projectList, tasksByProject, activeProject, today],
    );
    const timeline = useMemo(() => buildTimeline(rows, today, scale), [rows, today, scale]);

    function change(next) {
        setView(next);
        writeView(next);
        setMenu(null);
    }

    // Menggeser linimasa agar hari `offset` berada pada `fraction` lebar area bar.
    const scrollToDay = useCallback((offset, fraction) => {
        const node = scrollRef.current;
        if (!node) return;
        const labelWidth = node.querySelector('.gantt-label')?.offsetWidth ?? 0;
        const visible = Math.max(0, (node.clientWidth || 0) - labelWidth);
        node.scrollLeft = Math.max(0, (offset + 0.5) * timeline.dayWidth - visible * fraction);
    }, [timeline.dayWidth]);
    const scrollToToday = () => scrollToDay(timeline.todayOffset, 1 / 3);

    // Posisi awal: hari ini. Bila semua deadline sudah lewat, tampilkan deadline
    // terakhir supaya bar tidak tersembunyi di kiri layar. Bergantung pada nilai
    // primitif agar refresh data berkala tidak menggeser posisi scroll pengguna.
    const lastEnd = rows.reduce((latest, row) => (row.end !== null && (latest === null || row.end > latest) ? row.end : latest), null);
    const lastEndOffset = lastEnd === null ? null : lastEnd - timeline.first;
    useEffect(() => {
        if (loading) return;
        if (lastEndOffset !== null && lastEndOffset < timeline.todayOffset) scrollToDay(lastEndOffset, 0.7);
        else scrollToDay(timeline.todayOffset, 1 / 3);
    }, [loading, mode, activeProject?.id, lastEndOffset, timeline.todayOffset, scrollToDay]);

    function openRow(row) {
        if (mode === 'projects') {
            change({ mode: 'tasks', projectId: row.id });
            return;
        }
        // Detail task adalah tempat due date diatur.
        const to = `/projects/${row.projectId ?? activeProject?.id}/tasks/${row.id}?view=mytask`;
        if (window.history?.pushState) {
            window.history.pushState({}, '', to);
            window.dispatchEvent(new Event('app:navigate'));
            return;
        }
        window.location.assign(to);
    }

    const overdue = rows.filter(row => row.overdue).length;
    const undated = rows.filter(row => row.end === null).length;
    const unit = mode === 'projects' ? 'project' : 'task';
    const summary = [
        `${rows.length} ${unit}`,
        overdue ? `${overdue} melewati deadline` : null,
        undated ? `${undated} belum punya ${mode === 'projects' ? 'deadline' : 'due date'}` : null,
    ].filter(Boolean).join(' · ');

    const scaleOptions = [{ value: 'auto', label: 'Auto' }, ...Object.entries(GANTT_SCALES).map(([value, option]) => ({ value, label: option.label }))];
    const scaleLabel = scale === 'auto' ? `Scale: Auto (${GANTT_SCALES[timeline.scale].label})` : `Scale: ${GANTT_SCALES[scale].label}`;
    const legend = mode === 'projects'
        ? [{ tone: 'project', label: 'Rentang project · bagian pekat = task selesai' }]
        : STATUS_OPTIONS.map(option => ({ tone: STATUS_TONES[option.value], label: option.label }));
    const emptyText = mode === 'projects' ? 'Belum ada project.' : activeProject ? 'Project ini belum memiliki task.' : 'Belum ada project.';

    return <div className="gantt-page">
        <div className="kanban-heading">
            <h1>{mode === 'projects' ? 'Calendar : Project Deadline Timeline' : 'Calendar : Task Deadline Timeline'}</h1>
        </div>

        <div className="mytask-filters task-filters gantt-controls" role="group" aria-label="Tampilan Gantt chart" ref={barRef}>
            <button type="button" className={`task-filter-button${mode === 'projects' ? ' is-active' : ''}`} aria-pressed={mode === 'projects'}
                onClick={() => change({ mode: 'projects', projectId: null })}>Project Deadlines</button>
            <button type="button" className={`task-filter-button${mode === 'tasks' ? ' is-active' : ''}`} aria-pressed={mode === 'tasks'}
                onClick={() => change({ mode: 'tasks', projectId: view.projectId })}>Task Timeline</button>

            {mode === 'tasks' && <FilterMenu id="gantt-project" open={menu === 'gantt-project'} onOpen={setMenu}
                label={activeProject?.name ?? 'Select Project'} active={Boolean(activeProject)}>
                <OptionList
                    options={projects.map(project => ({ value: project.id, label: project.name }))}
                    value={activeProject?.id ?? null}
                    onSelect={projectId => change({ mode: 'tasks', projectId })}
                />
            </FilterMenu>}

            <FilterMenu id="gantt-scale" open={menu === 'gantt-scale'} onOpen={setMenu} label={scaleLabel}>
                <OptionList options={scaleOptions} value={scale} onSelect={value => { setScale(value); setMenu(null); }} />
            </FilterMenu>

            <button type="button" className="task-filter-button" onClick={scrollToToday}>Today</button>
        </div>

        {loading && <p className="projects-empty" role="status">Memuat timeline…</p>}
        {error && <p className="projects-error" role="alert">{error}</p>}

        {!loading && <section className="gantt-card" aria-label={mode === 'projects' ? 'Gantt chart deadline project' : `Gantt chart task ${activeProject?.name ?? ''}`.trim()}>
            <div className="gantt-card-head">
                <p className="gantt-summary">{mode === 'tasks' && activeProject ? <><strong>{activeProject.name}</strong> · </> : null}{summary}</p>
                <ul className="gantt-legend" aria-label="Keterangan warna">
                    {legend.map(item => <li key={item.tone} className={`gantt-tone-${item.tone}`}><span className="gantt-swatch" aria-hidden="true" />{item.label}</li>)}
                    <li><span className="gantt-swatch gantt-swatch-today" aria-hidden="true" />Hari ini</li>
                </ul>
            </div>

            {rows.length === 0
                ? <p className="projects-empty">{emptyText}{mode === 'projects' || !activeProject ? <> <a href="/projects">Buka Projects</a></> : null}</p>
                : <div className="gantt-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Linimasa, geser horizontal untuk melihat tanggal lain">
                    <div className="gantt-grid">
                        <div className="gantt-head" aria-hidden="true">
                            <div className="gantt-label">{mode === 'projects' ? 'Project' : 'Task'}</div>
                            <div className="gantt-timeline-head" style={{ width: timeline.width }}>
                                <div className="gantt-months">
                                    {timeline.months.map(month => <span key={month.key} style={{ width: month.days * timeline.dayWidth }}><b>{month.label}</b></span>)}
                                </div>
                                <div className="gantt-ticks">
                                    {timeline.ticks.filter(tick => tick.span > 0).map(tick => <span
                                        key={tick.offset}
                                        className={tick.today ? 'is-today' : undefined}
                                        style={{ left: tick.offset * timeline.dayWidth, width: tick.span * timeline.dayWidth }}
                                    >{tick.label}</span>)}
                                    {timeline.scale !== 'day' && <span className="gantt-today-flag" style={{ left: (timeline.todayOffset + 0.5) * timeline.dayWidth }}>Today</span>}
                                </div>
                            </div>
                        </div>
                        <div className="gantt-body">
                            <div className="gantt-lines" style={{ width: timeline.width }} aria-hidden="true">
                                {timeline.ticks.map(tick => <span
                                    key={tick.offset}
                                    className={tick.weekend ? 'gantt-line is-weekend' : 'gantt-line'}
                                    style={{ left: tick.offset * timeline.dayWidth, width: tick.weekend ? timeline.dayWidth : undefined }}
                                />)}
                                <span className="gantt-today" style={{ left: (timeline.todayOffset + 0.5) * timeline.dayWidth }} />
                            </div>
                            <div role="list" aria-label={mode === 'projects' ? 'Daftar project' : 'Daftar task'}>
                                {rows.map(row => <GanttRow key={row.id} row={row} mode={mode} timeline={timeline} onOpen={openRow} />)}
                            </div>
                        </div>
                    </div>
                </div>}

            <p className="gantt-hint">{mode === 'projects'
                ? 'Deadline project mengikuti due date task terakhirnya. Klik sebuah project untuk melihat timeline task-nya.'
                : 'Bar dimulai saat task dibuat dan berakhir pada due date. Klik sebuah task untuk membuka detail dan mengatur due date-nya.'}</p>
        </section>}
    </div>;
}

export default GanttCalendar;
