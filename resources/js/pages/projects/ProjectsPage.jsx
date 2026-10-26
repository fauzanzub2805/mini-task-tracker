import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ProjectDetail } from './ProjectDetail.jsx';
import { TaskDetail } from './TaskDetail.jsx';
import {
    notifyProjectsChanged,
    priorityLabel,
    priorityKey,
    projectsApi,
    statusClass,
    statusLabel,
} from './projectsApi.js';

const SORT_OPTIONS = [
    { id: 'alphabet', label: 'Alphabet (A-Z)' },
    { id: 'newest', label: 'Newest → Oldest' },
    { id: 'oldest', label: 'Oldest → Newest' },
    { id: 'tasks', label: 'Amount of Task (Big → Small)' },
];

function readPath() {
    if (typeof window === 'undefined') return '/projects';
    return `${window.location.pathname}${window.location.search}`;
}

function useRoute(initialPath) {
    const [location, setLocation] = useState(initialPath ?? readPath());

    useEffect(() => {
        if (initialPath !== undefined) return undefined;
        const onPop = () => setLocation(readPath());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [initialPath]);

    const navigate = useCallback(to => {
        if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState({}, '', to);
            window.dispatchEvent(new Event('projects:navigate'));
        }
        setLocation(to);
    }, []);

    return { location, navigate };
}

function parseRoute(location) {
    const [rawPath, rawQuery = ''] = String(location || '/projects').split('?');
    const segments = rawPath.split('/').filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(rawQuery);
    const projectId = segments[1] ? Number(segments[1]) : null;
    const taskId = segments[3] ? Number(segments[3]) : null;
    return {
        segments,
        params,
        projectId: Number.isFinite(projectId) ? projectId : null,
        taskId: Number.isFinite(taskId) ? taskId : null,
        view: params.get('view'),
        query: params.get('q') ?? '',
    };
}

function projectRole(members, user) {
    const membership = members.find(member => member.user_id === user?.id || member.user?.id === user?.id);
    return membership?.role?.name;
}

export function canManageProject(project, members, user) {
    if (!user) return false;
    if (project?.permissions) {
        const permissions = project.permissions;
        return Boolean(permissions.manageMembers ?? permissions.manage_members ?? permissions.manageAssignee ?? permissions.update);
    }
    if ((user.roles ?? []).includes('admin')) return true;
    return projectRole(members, user) === 'manager';
}

export function canCreateProject(user) {
    const roles = user?.roles ?? [];
    return roles.includes('admin') || roles.includes('manager');
}

function Toolbar({ search, onSearch, onCreate, canCreate, sortOpen, onSortOpen, sort, onSort, onApplySearch }) {
    return <div className="projects-toolbar">
        <form className="projects-search" role="search" onSubmit={event => { event.preventDefault(); onApplySearch(); }}>
            <input
                type="search"
                aria-label="Find a project"
                placeholder="Find a project..."
                value={search}
                onChange={event => onSearch(event.target.value)}
            />
            <button type="submit" className="projects-search-button" aria-label="Cari project">⌕</button>
        </form>
        <div className="projects-sort">
            <button type="button" className="projects-tool-button" aria-label="Urutkan project" aria-expanded={sortOpen} onClick={onSortOpen}>⇅</button>
            {sortOpen && <ul className="projects-menu projects-sort-menu" role="listbox" aria-label="Select Sort">
                <li className="projects-sort-title" aria-hidden="true">Select Sort</li>
                {SORT_OPTIONS.map(option => <li key={option.id}>
                    <button type="button" role="option" aria-selected={sort === option.id} onClick={() => onSort(option.id)}>
                        {option.label}{sort === option.id && <span aria-hidden="true">✓</span>}
                    </button>
                </li>)}
            </ul>}
        </div>
        {canCreate && <button type="button" className="projects-create" onClick={onCreate}>Create New Project</button>}
    </div>;
}

function ProjectCards({ projects, navigate }) {
    if (!projects.length) return <p className="projects-empty">Belum ada project. Buat project baru untuk mulai bekerja.</p>;

    return <div className="projects-grid">
        {projects.map(project => <a
            key={project.id}
            className="projects-card"
            href={`/projects/${project.id}`}
            onClick={event => { event.preventDefault(); navigate(`/projects/${project.id}`); }}
        >
            <div className="projects-card-media">
                {project.image_url
                    ? <img src={project.image_url} alt={`Gambar project ${project.name}`} />
                    : <div className="projects-image-placeholder" role="img" aria-label="Insert Image">
                        <span aria-hidden="true">!</span>
                        <p>Insert Image</p>
                    </div>}
            </div>
            <h2>{project.name}</h2>
            <p>{project.description || '(No detailed information of project)'}</p>
        </a>)}
    </div>;
}

function CreateProjectForm({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(event) {
        event.preventDefault();
        if (!name.trim()) { setError('Nama project wajib diisi.'); return; }
        setBusy(true); setError('');
        try {
            const created = await projectsApi.create({ name: name.trim(), description });
            const project = created?.data ?? created;
            notifyProjectsChanged();
            onCreated(project);
        } catch (failure) {
            setError(failure.message);
            setBusy(false);
        }
    }

    return <form className="projects-form" onSubmit={submit} aria-label="Create New Project">
        <div className="projects-field">
            <label className="projects-field-label" htmlFor="projects-new-name">Project Name</label>
            <div className="projects-field-body"><input id="projects-new-name" value={name} maxLength={200} required onChange={event => setName(event.target.value)} /></div>
        </div>
        <div className="projects-field">
            <label className="projects-field-label" htmlFor="projects-new-description">Description</label>
            <div className="projects-field-body"><textarea id="projects-new-description" rows={4} value={description} onChange={event => setDescription(event.target.value)} /></div>
        </div>
        {error && <p className="projects-error" role="alert">{error}</p>}
        <div className="projects-form-actions">
            <button type="submit" className="projects-primary" disabled={busy}>Create Project</button>
            <button type="button" className="projects-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
    </form>;
}

function TasksOverview({ projects }) {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        setLoading(true);
        Promise.all(projects.map(async project => (await projectsApi.tasks(project.id, { signal: controller.signal }))
            .map(task => ({ ...task, project }))))
            .then(groups => { if (alive) { setRows(groups.flat()); setError(''); } })
            .catch(failure => { if (alive && failure.name !== 'AbortError') setError(failure.message); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; controller.abort(); };
    }, [projects]);

    return <div className="projects-table-card">
        <h2>All Tasks</h2>
        {loading && <p role="status">Memuat task…</p>}
        {error && <p className="projects-error" role="alert">{error}</p>}
        {!loading && rows.length === 0 && <p className="projects-empty">Belum ada task.</p>}
        {rows.length > 0 && <div className="projects-table-scroll">
            <table className="projects-table">
                <thead><tr>{['Task', 'Project', 'Assignee', 'Priority', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                <tbody>{rows.map(task => <tr key={`${task.project.id}-${task.id}`}>
                    <td><a href={`/projects/${task.project.id}/tasks/${task.id}`}>{task.title}</a></td>
                    <td><a href={`/projects/${task.project.id}`}>{task.project.name}</a></td>
                    <td>{task.assignees?.map(person => person.name).join(', ') || task.assignee?.name || 'Unassigned'}</td>
                    <td><span className={`projects-priority-pill priority-${priorityKey(task.priority)}`}>{priorityLabel(task.priority)}</span></td>
                    <td><span className={`projects-status-badge status-${statusClass(task.status)}`}>{statusLabel(task.status)}</span></td>
                </tr>)}</tbody>
            </table>
        </div>}
    </div>;
}

function TeamsOverview({ projects }) {
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        setLoading(true);
        Promise.all(projects.map(async project => ({ project, members: await projectsApi.members(project.id, { signal: controller.signal }) })))
            .then(groups => { if (alive) { setRows(groups); setError(''); } })
            .catch(failure => { if (alive && failure.name !== 'AbortError') setError(failure.message); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; controller.abort(); };
    }, [projects]);

    return <div className="projects-table-card">
        <h2>All Teams</h2>
        {loading && <p role="status">Memuat anggota project…</p>}
        {error && <p className="projects-error" role="alert">{error}</p>}
        {!loading && rows.length === 0 && <p className="projects-empty">Belum ada project.</p>}
        {rows.length > 0 && <div className="projects-table-scroll">
            <table className="projects-table">
                <thead><tr>{['Project', 'Manager', 'Members', 'Total'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                <tbody>{rows.map(({ project, members }) => <tr key={project.id}>
                    <td><a href={`/projects/${project.id}`}>{project.name}</a></td>
                    <td>{members.filter(member => member.role?.name === 'manager').map(member => member.user?.name).join(', ') || '—'}</td>
                    <td>{members.map(member => member.user?.name).filter(Boolean).join(', ') || '—'}</td>
                    <td>{members.length}</td>
                </tr>)}</tbody>
            </table>
        </div>}
    </div>;
}

export function ProjectsPage({ user = null, path }) {
    const { location, navigate } = useRoute(path);
    const route = parseRoute(location);
    const { projectId, taskId, view } = route;

    const [projects, setProjects] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [search, setSearch] = useState(route.query);
    const [sort, setSort] = useState('newest');
    const [sortOpen, setSortOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [listError, setListError] = useState('');
    const [loadingList, setLoadingList] = useState(true);

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [activities, setActivities] = useState([]);
    const [projectError, setProjectError] = useState('');
    const [loadingProject, setLoadingProject] = useState(false);

    const dirtyRef = useRef(false);

    const loadProjects = useCallback(async signal => {
        try {
            const rows = await projectsApi.list({ signal });
            setProjects(rows);
            setListError('');
        } catch (failure) {
            if (failure.name !== 'AbortError') setListError(failure.message);
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        loadProjects(controller.signal);
        return () => controller.abort();
    }, [loadProjects]);

    useEffect(() => {
        let alive = true;
        projectsApi.priorities()
            .then(response => { if (alive) setPriorities(response?.data ?? response ?? []); })
            .catch(() => { if (alive) setPriorities([]); });
        return () => { alive = false; };
    }, []);

    // Daftar project tetap segar (10 detik + fokus + perubahan dari halaman lain).
    useEffect(() => {
        let pending = false;
        const refresh = async () => {
            if (pending || document.visibilityState === 'hidden') return;
            pending = true;
            await loadProjects();
            pending = false;
        };
        const timer = setInterval(refresh, 10000);
        window.addEventListener('focus', refresh);
        window.addEventListener('projects:changed', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('projects:changed', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [loadProjects]);

    // Data project aktif: project, task, anggota, aktivitas.
    useEffect(() => {
        if (!projectId) {
            setProject(null); setTasks([]); setMembers([]); setActivities([]); setProjectError('');
            dirtyRef.current = false;
            return undefined;
        }

        const controller = new AbortController();
        let pending = false;
        setLoadingProject(true);

        async function load() {
            // Polling tetap berjalan walau ada draft; komponen anak yang menjaga
            // agar draft pengguna tidak tertimpa data server.
            if (pending || document.visibilityState === 'hidden') return;
            pending = true;
            try {
                const [freshProject, freshTasks, freshMembers, freshActivities] = await Promise.all([
                    projectsApi.get(projectId, { signal: controller.signal }),
                    projectsApi.tasks(projectId, { signal: controller.signal }),
                    projectsApi.members(projectId, { signal: controller.signal }),
                    projectsApi.activities(projectId, { signal: controller.signal }),
                ]);
                if (controller.signal.aborted) return;
                setProject(freshProject?.data ?? freshProject);
                setTasks(freshTasks);
                setMembers(freshMembers);
                setActivities(freshActivities);
                setProjectError('');
            } catch (failure) {
                if (!controller.signal.aborted && failure.name !== 'AbortError') setProjectError(failure.message);
            } finally {
                pending = false;
                if (!controller.signal.aborted) setLoadingProject(false);
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
    }, [projectId]);

    const visibleProjects = useMemo(() => {
        const term = search.trim().toLowerCase();
        const rows = projects.filter(project => !term
            || project.name.toLowerCase().includes(term)
            || (project.description ?? '').toLowerCase().includes(term));
        const sorted = [...rows];
        if (sort === 'alphabet') sorted.sort((a, b) => a.name.localeCompare(b.name, 'id'));
        if (sort === 'newest') sorted.sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
        if (sort === 'oldest') sorted.sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
        if (sort === 'tasks') sorted.sort((a, b) => (b.tasks_count ?? 0) - (a.tasks_count ?? 0));
        return sorted;
    }, [projects, search, sort]);

    // Mengetik pencarian di halaman detail mengarahkan kembali ke daftar project.
    useEffect(() => {
        if (projectId && route.query) setSearch(route.query);
    }, [projectId, route.query]);

    function applySearch() {
        if (projectId) {
            navigate(`/projects?q=${encodeURIComponent(search)}`);
            return;
        }
        navigate(search ? `/projects?q=${encodeURIComponent(search)}` : '/projects');
    }

    const taskTitle = tasks.find(task => task.id === taskId)?.title;
    const manage = canManageProject(project, members, user);

    return <div className="projects-page">
        <div className="projects-heading">
            <h1>{taskId ? (taskTitle ?? 'Task Detail') : projectId ? (project?.name ?? 'Project') : view === 'tasks' ? 'Tasks' : view === 'teams' ? 'Teams' : 'Project'}</h1>
        </div>

        <Toolbar
            search={search}
            onSearch={setSearch}
            onApplySearch={applySearch}
            onCreate={() => setCreating(true)}
            canCreate={canCreateProject(user)}
            sortOpen={sortOpen}
            onSortOpen={() => setSortOpen(!sortOpen)}
            sort={sort}
            onSort={value => { setSort(value); setSortOpen(false); }}
        />

        {listError && <p className="projects-error" role="alert">{listError}</p>}
        {projectError && <p className="projects-error" role="alert">{projectError}</p>}

        {!projectId && loadingList && <p className="projects-empty" role="status">Memuat project…</p>}
        {!projectId && !loadingList && !view && <>
            {route.query && <p className="projects-search-note">Hasil pencarian untuk “{route.query}”.</p>}
            <ProjectCards projects={visibleProjects} navigate={navigate} />
        </>}
        {!projectId && view === 'tasks' && <TasksOverview projects={projects} />}
        {!projectId && view === 'teams' && <TeamsOverview projects={projects} />}

        {projectId && loadingProject && !project && <p className="projects-empty" role="status">Memuat detail project…</p>}
        {projectId && project && !taskId && <ProjectDetail
            project={project}
            tasks={tasks}
            members={members}
            activities={activities}
            priorities={priorities}
            user={user}
            canManage={manage}
            navigate={navigate}
            onRefresh={() => window.dispatchEvent(new Event('projects:changed'))}
        />}
        {projectId && project && taskId && <>
            <TaskDetail
                taskId={taskId}
                project={project}
                members={members}
                activities={activities}
                priorities={priorities}
                user={user}
                canManage={manage}
                navigate={navigate}
                onRefresh={() => window.dispatchEvent(new Event('projects:changed'))}
                dirtyRef={dirtyRef}
            />
        </>}

        {creating && <Modal title="Create New Project" onClose={() => setCreating(false)} labelledBy="projects-create-title">
            <CreateProjectForm
                onClose={() => setCreating(false)}
                onCreated={created => {
                    setCreating(false);
                    if (created?.id) navigate(`/projects/${created.id}`);
                    else navigate('/projects');
                }}
            />
        </Modal>}
    </div>;
}

export default ProjectsPage;
