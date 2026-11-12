import { useEffect, useMemo, useRef, useState } from 'react';
import { priorityLabel, priorityOptions, STATUS_OPTIONS, statusLabel } from './projectsApi.js';

/**
 * Filter bar halaman My Tasks (Tasks view). Urutan tombol mengikuti Figma
 * "Task Page_11 Nov": Assigned to me → Created by → All Projects →
 * Any Priority → Any Status → Assigned to.
 *
 * Seluruh penyaringan dilakukan di sisi klien atas task yang sudah dimuat,
 * karena daftar task memang dikumpulkan dari semua project yang terlihat oleh
 * pengguna.
 */
export const DEFAULT_TASK_FILTERS = {
    mine: false,
    createdBy: null,
    projectId: null,
    priority: null,
    status: null,
    assignee: null,
};

/** Membaca filter dari query string agar bar di halaman detail bisa membuka daftar terfilter. */
export function filtersFromQuery(params) {
    const get = key => (params?.get ? params.get(key) : null);
    const number = key => {
        const raw = get(key);
        const value = raw === null || raw === '' ? NaN : Number(raw);
        return Number.isFinite(value) ? value : null;
    };
    return {
        ...DEFAULT_TASK_FILTERS,
        mine: get('mine') === '1',
        createdBy: number('created_by'),
        projectId: number('project'),
        priority: get('priority') || null,
        status: get('status') || null,
        assignee: number('assignee'),
    };
}

export function filtersToQuery(filters) {
    const parts = [];
    const push = (key, value) => {
        if (value === null || value === undefined || value === '' || value === false) return;
        parts.push(`${key}=${encodeURIComponent(value)}`);
    };
    push('mine', filters.mine ? '1' : null);
    push('created_by', filters.createdBy);
    push('project', filters.projectId);
    push('priority', filters.priority);
    push('status', filters.status);
    push('assignee', filters.assignee);
    return parts.join('&');
}

function assigneeIdsOf(task) {
    const ids = (task.assignees ?? []).map(person => person.id).filter(Boolean);
    if (task.assignee?.id) ids.push(task.assignee.id);
    if (task.assignee_id) ids.push(task.assignee_id);
    return ids;
}

export function filterTasks(rows, filters, currentUserId, term = '') {
    const needle = String(term ?? '').trim().toLowerCase();
    return rows.filter(task => {
        if (needle && !String(task.title ?? '').toLowerCase().includes(needle)) return false;
        if (filters.mine && !assigneeIdsOf(task).includes(currentUserId)) return false;
        const creatorId = task.created_by_id ?? task.creator?.id ?? null;
        if (filters.createdBy && creatorId !== filters.createdBy) return false;
        if (filters.projectId && (task.project?.id ?? task.project_id) !== filters.projectId) return false;
        if (filters.priority && (task.priority?.name ?? task.priority_id) !== filters.priority) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.assignee && !assigneeIdsOf(task).includes(filters.assignee)) return false;
        return true;
    });
}

/** Dropdown generik: daftar tombol pilihan dengan panel yang bisa ditutup. */
function FilterMenu({ id, open, onOpen, label, chevron = true, active = false, children }) {
    return <div className="task-filter">
        <button
            type="button"
            className={`task-filter-button${active ? ' is-active' : ''}`}
            aria-expanded={open}
            aria-controls={open ? `task-filter-${id}` : undefined}
            onClick={() => onOpen(open ? null : id)}
        >
            {label}{chevron && <span className="task-filter-chevron" aria-hidden="true">›</span>}
        </button>
        {open && <div className="task-filter-menu" id={`task-filter-${id}`} role="dialog" aria-label={label}>
            {children}
        </div>}
    </div>;
}

function OptionList({ options, value, emptyLabel, onSelect }) {
    return <ul className="task-filter-options" role="listbox">
        {emptyLabel && <li>
            <button type="button" role="option" aria-selected={value === null} onClick={() => onSelect(null)}>
                {emptyLabel}{value === null && <span aria-hidden="true">✓</span>}
            </button>
        </li>}
        {options.map(option => <li key={option.value}>
            <button type="button" role="option" aria-selected={value === option.value} onClick={() => onSelect(option.value)}>
                {option.label}{value === option.value && <span aria-hidden="true">✓</span>}
            </button>
        </li>)}
    </ul>;
}

/** Dropdown dengan kolom pencarian: menampilkan semua nama sebelum ada input. */
function PeopleMenu({ label, placeholder, options, value, emptyLabel, onSelect }) {
    const [term, setTerm] = useState('');
    const needle = term.trim().toLowerCase();
    const rows = needle ? options.filter(person => person.name.toLowerCase().includes(needle)) : options;

    return <>
        <input
            type="search"
            className="task-filter-search"
            aria-label={placeholder}
            placeholder={placeholder}
            value={term}
            onChange={event => setTerm(event.target.value)}
            autoFocus
        />
        <ul className="task-filter-options" role="listbox" aria-label={label}>
            {/* Opsi default: tampilkan semua tanpa filter, seperti "All Projects". */}
            <li>
                <button type="button" role="option" aria-selected={value === null} onClick={() => onSelect(null)}>
                    {emptyLabel}{value === null && <span aria-hidden="true">✓</span>}
                </button>
            </li>
            {rows.map(person => <li key={person.id}>
                <button type="button" role="option" aria-selected={value === person.id} onClick={() => onSelect(person.id)}>
                    {person.name}{value === person.id && <span aria-hidden="true">✓</span>}
                </button>
            </li>)}
        </ul>
        {rows.length === 0 && <p className="task-filter-empty">Nama tidak ditemukan.</p>}
    </>;
}

export function TaskFilters({ filters, onChange, projects = [], priorities = [], users = [] }) {
    const [open, setOpen] = useState(null);
    const barRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = event => {
            if (!barRef.current?.contains(event.target)) setOpen(null);
        };
        const escape = event => { if (event.key === 'Escape') setOpen(null); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    function set(key, value) {
        onChange({ ...filters, [key]: value });
        setOpen(null);
    }

    // "Created by" hanya menawarkan Project Manager (dan Admin sebagai pemilik
    // wewenang tertinggi) karena merekalah pembuat project.
    const managers = useMemo(() => users.filter(person => {
        const roles = person.roles ?? [];
        return roles.includes('manager') || roles.includes('admin');
    }), [users]);

    const priorityChoices = useMemo(() => [...priorityOptions(priorities)]
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
        .map(priority => ({ value: priority.name, label: priorityLabel(priority) })), [priorities]);

    const statusOptions = STATUS_OPTIONS.map(option => ({ value: option.value, label: option.label }));
    const projectOptions = projects.map(project => ({ value: project.id, label: project.name }));

    const creatorName = managers.find(person => person.id === filters.createdBy)?.name;
    const assigneeName = users.find(person => person.id === filters.assignee)?.name;
    const projectName = projects.find(project => project.id === filters.projectId)?.name;

    return <div className="mytask-filters task-filters" role="group" aria-label="Filter task" ref={barRef}>
        <button
            type="button"
            className={`task-filter-button${filters.mine ? ' is-active' : ''}`}
            aria-pressed={filters.mine}
            onClick={() => set('mine', !filters.mine)}
        >Assigned to me</button>

        <FilterMenu id="created-by" open={open === 'created-by'} onOpen={setOpen}
            label={creatorName ?? 'Created by'} active={Boolean(filters.createdBy)}>
            <PeopleMenu
                label="Created by"
                placeholder="Search project manager"
                options={managers}
                value={filters.createdBy}
                emptyLabel="Created by"
                onSelect={value => set('createdBy', value)}
            />
        </FilterMenu>

        <FilterMenu id="project" open={open === 'project'} onOpen={setOpen}
            label={projectName ?? 'All Projects'} active={Boolean(filters.projectId)}>
            <OptionList options={projectOptions} value={filters.projectId} emptyLabel="All Projects" onSelect={value => set('projectId', value)} />
        </FilterMenu>

        <FilterMenu id="priority" open={open === 'priority'} onOpen={setOpen}
            label={filters.priority ? priorityLabel({ name: filters.priority }) : 'Any Priority'} active={Boolean(filters.priority)}>
            <OptionList options={priorityChoices} value={filters.priority} emptyLabel="Any Priority" onSelect={value => set('priority', value)} />
        </FilterMenu>

        <FilterMenu id="status" open={open === 'status'} onOpen={setOpen}
            label={filters.status ? statusLabel(filters.status) : 'Any Status'} active={Boolean(filters.status)}>
            <OptionList options={statusOptions} value={filters.status} emptyLabel="Any Status" onSelect={value => set('status', value)} />
        </FilterMenu>

        <FilterMenu id="assignee" open={open === 'assignee'} onOpen={setOpen} chevron={false}
            label={assigneeName ?? 'Assigned to'} active={Boolean(filters.assignee)}>
            <PeopleMenu
                label="Assigned to"
                placeholder="Search assignee"
                options={users}
                value={filters.assignee}
                emptyLabel="Assigned to"
                onSelect={value => set('assignee', value)}
            />
        </FilterMenu>
    </div>;
}

export default TaskFilters;
