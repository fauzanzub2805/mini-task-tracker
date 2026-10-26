import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPicker } from './CalendarPicker.jsx';
import {
    formatDay,
    formatCommentStamp,
    notifyProjectsChanged,
    priorityKey,
    priorityLabel,
    priorityOptions,
    projectsApi,
    statusClass,
    statusLabel,
    STATUS_OPTIONS,
} from './projectsApi.js';

export function ProjectTabs({ items, active, onChange, label = 'Navigasi project' }) {
    return <div className="projects-tabs" role="tablist" aria-label={label}>
        {items.map(item => <button
            key={item.id}
            type="button"
            role="tab"
            id={`projects-tab-${item.id}`}
            aria-selected={active === item.id}
            aria-controls={`projects-panel-${item.id}`}
            className={`projects-tab${active === item.id ? ' is-active' : ''}`}
            onClick={() => onChange(item.id)}
        >{item.label}</button>)}
    </div>;
}

export function Modal({ title, onClose, children, labelledBy = 'projects-modal-title' }) {
    useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return <div className="projects-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="projects-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
            <div className="projects-modal-head">
                <h2 id={labelledBy}>{title}</h2>
                <button type="button" aria-label="Tutup" onClick={onClose}>×</button>
            </div>
            {children}
        </div>
    </div>;
}

function projectDeadline(project, tasks) {
    if (project?.deadline) return project.deadline;
    if (project?.due_date) return project.due_date;
    const dates = tasks.map(task => task.due_date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
}

function ImageBlock({ project }) {
    if (project?.image_url) return <img className="projects-detail-image" src={project.image_url} alt={`Gambar project ${project.name}`} />;
    return <div className="projects-detail-image projects-image-placeholder" role="img" aria-label="Insert Image">
        <span aria-hidden="true">!</span>
        <p>Insert Image</p>
    </div>;
}

export function ProjectInfoTab({ project, tasks, priorities, onAddTask, navigate }) {
    const deadline = projectDeadline(project, tasks);

    return <div className="projects-info">
        <ImageBlock project={project} />
        <h2 className="projects-info-title">{project.name}</h2>
        <p className="projects-info-description">{project.description || '(No detailed information of project)'}</p>
        {deadline && <p className="projects-info-deadline">Project Deadline : {formatDay(deadline)}</p>}

        <div className="projects-task-list">
            {tasks.length === 0 && <p className="projects-empty">Belum ada task pada project ini.</p>}
            {tasks.map(task => <a
                key={task.id}
                className="projects-task-row"
                href={`/projects/${project.id}/tasks/${task.id}`}
                onClick={event => { event.preventDefault(); navigate(`/projects/${project.id}/tasks/${task.id}`); }}
            >
                <span className={`projects-priority-pill priority-${priorityKey(task.priority)}`}>{priorityLabel(task.priority)}</span>
                <span className="projects-task-text">
                    <strong>{task.title}</strong>
                    <small>{task.description || 'Belum ada deskripsi'}</small>
                </span>
                <span className={`projects-status-badge status-${statusClass(task.status)}`}>{statusLabel(task.status)}</span>
            </a>)}
        </div>

        <div className="projects-info-actions">
            <button type="button" className="projects-primary" onClick={onAddTask}>Add New Task</button>
        </div>
    </div>;
}

export function ActivityTab({ activities, emptyLabel = 'Belum ada aktivitas pada project ini.' }) {
    return <div className="projects-activity" role="tabpanel">
        {activities.length === 0
            ? <p className="projects-empty">{emptyLabel}</p>
            : <ul className="projects-activity-list">
                {activities.map(activity => <li key={activity.id}>
                    <span className="projects-activity-dot" aria-hidden="true" />
                    <div>
                        <p><strong>{activity.user?.name ?? 'Sistem'}</strong> {activity.description}</p>
                        <small>{formatCommentStamp(activity.created_at)}</small>
                    </div>
                </li>)}
            </ul>}
    </div>;
}

// Peran project hanya "manager" dan "staff" (PRD 4.1) dan API anggota project
// hanya menerima role_id. role_id staff diambil dari anggota project yang ada,
// bukan angka hardcode, supaya tetap valid bila seed/id berubah.
export function staffRoleId(members = []) {
    return members.find(member => member.role?.name === 'staff')?.role?.id ?? null;
}

export function SettingsTab({ project, members = [], canManage, navigate, onRefresh }) {
    const [name, setName] = useState(project.name ?? '');
    const [description, setDescription] = useState(project.description ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const [people, setPeople] = useState([]);
    const [peopleError, setPeopleError] = useState('');
    const [newMemberId, setNewMemberId] = useState('');
    const [memberBusy, setMemberBusy] = useState(false);
    const [memberError, setMemberError] = useState('');
    const [memberNotice, setMemberNotice] = useState('');

    // Draft nama/deskripsi tidak boleh tertimpa polling selama belum disimpan.
    const dirtyRef = useRef(false);
    const projectIdRef = useRef(project.id);

    useEffect(() => {
        const sameProject = projectIdRef.current === project.id;
        projectIdRef.current = project.id;
        if (sameProject && dirtyRef.current) return;
        dirtyRef.current = false;
        setName(project.name ?? '');
        setDescription(project.description ?? '');
    }, [project.id, project.name, project.description]);

    useEffect(() => {
        if (!canManage) return undefined;
        let alive = true;
        projectsApi.users()
            .then(rows => { if (alive) { setPeople(rows); setPeopleError(''); } })
            .catch(failure => { if (alive) setPeopleError(failure.message); });
        return () => { alive = false; };
    }, [canManage]);

    const roleId = staffRoleId(members);
    const existingIds = useMemo(() => new Set(members.map(member => member.user_id)), [members]);
    const candidates = people.filter(person => !existingIds.has(person.id));

    async function save(event) {
        event.preventDefault();
        if (!name.trim()) { setError('Nama project wajib diisi.'); return; }
        setBusy(true); setError(''); setNotice('');
        try {
            await projectsApi.update(project.id, { name: name.trim(), description });
            dirtyRef.current = false;
            notifyProjectsChanged();
            setNotice('Perubahan project disimpan.');
            onRefresh?.();
        } catch (failure) {
            setError(failure.message);
        } finally {
            setBusy(false);
        }
    }

    async function addMember(event) {
        event.preventDefault();
        if (!newMemberId) return;
        setMemberBusy(true); setMemberError(''); setMemberNotice('');
        try {
            await projectsApi.addMember(project.id, { user_id: Number(newMemberId), ...(roleId ? { role_id: roleId } : { role: 'staff' }) });
            setNewMemberId('');
            setMemberNotice('Anggota ditambahkan ke project.');
            notifyProjectsChanged();
            onRefresh?.();
        } catch (failure) {
            setMemberError(failure.message);
        } finally {
            setMemberBusy(false);
        }
    }

    async function remove() {
        if (!window.confirm(`Hapus project "${project.name}"?`)) return;
        setBusy(true); setError(''); setNotice('');
        try {
            await projectsApi.remove(project.id);
            notifyProjectsChanged();
            navigate('/projects');
        } catch (failure) {
            setError(failure.message);
        } finally {
            setBusy(false);
        }
    }

    if (!canManage) {
        return <div className="projects-setting" role="tabpanel">
            <p className="projects-empty">Hanya Project Manager yang dapat mengubah pengaturan project.</p>
        </div>;
    }

    return <div className="projects-setting" role="tabpanel">
        <form className="projects-form" onSubmit={save}>
            <div className="projects-field">
                <label className="projects-field-label" htmlFor="projects-setting-name">Project Name</label>
                <div className="projects-field-body"><input id="projects-setting-name" value={name} maxLength={200} onChange={event => { dirtyRef.current = true; setName(event.target.value); }} /></div>
            </div>
            <div className="projects-field">
                <label className="projects-field-label" htmlFor="projects-setting-description">Description</label>
                <div className="projects-field-body"><textarea id="projects-setting-description" rows={5} value={description} onChange={event => { dirtyRef.current = true; setDescription(event.target.value); }} /></div>
            </div>
            {error && <p className="projects-error" role="alert">{error}</p>}
            {notice && <p className="projects-notice" role="status">{notice}</p>}
            <div className="projects-form-actions">
                <button type="submit" className="projects-primary" disabled={busy}>Save Changes</button>
                <button type="button" className="projects-secondary" disabled={busy} onClick={remove}>Delete Project</button>
            </div>
        </form>

        <section className="projects-setting-members" aria-label="Project Members">
            <h3>Project Members</h3>
            <ul className="projects-setting-member-list">
                {members.map(member => <li key={member.user_id}>
                    <span className="projects-avatar" aria-hidden="true">{member.user?.name?.slice(0, 1)}</span>
                    {member.user?.name ?? `User #${member.user_id}`}
                    <small> · {member.role?.name ?? 'staff'}</small>
                </li>)}
            </ul>
            <form className="projects-member-form" onSubmit={addMember} aria-label="Add Project Member">
                <label className="projects-field-label" htmlFor="projects-setting-new-member">Add existing user</label>
                <div className="projects-member-row">
                    <select
                        id="projects-setting-new-member"
                        value={newMemberId}
                        onChange={event => setNewMemberId(event.target.value)}
                    >
                        <option value="">Pilih user</option>
                        {candidates.map(person => <option key={person.id} value={String(person.id)}>{person.name}</option>)}
                    </select>
                    <button type="submit" className="projects-primary" disabled={memberBusy || !newMemberId}>Add Member</button>
                </div>
                {peopleError && <p className="projects-error" role="alert">{peopleError}</p>}
                {memberError && <p className="projects-error" role="alert">{memberError}</p>}
                {memberNotice && <p className="projects-notice" role="status">{memberNotice}</p>}
            </form>
        </section>
    </div>;
}

export function CreateTaskForm({ project, members, priorities, canManage = false, navigate, onRefresh, onClose }) {
    const options = useMemo(() => priorityOptions(priorities), [priorities]);
    const [form, setForm] = useState({ title: '', description: '', status: 'todo', priority_id: options.find(option => option.name === 'medium')?.id ?? '', due_date: '', assignee_id: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    function update(key, value) {
        setForm(current => ({ ...current, [key]: value }));
    }

    async function submit(event) {
        event.preventDefault();
        if (!form.title.trim()) { setError('Title wajib diisi.'); return; }
        setBusy(true); setError('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description,
                status: form.status,
                due_date: form.due_date || null,
            };
            // Staff tidak berwenang mengatur assignee: field tidak dikirim sama sekali.
            if (canManage) payload.assignee_id = form.assignee_id ? Number(form.assignee_id) : null;
            if (form.priority_id) payload.priority_id = Number(form.priority_id);
            const created = await projectsApi.createTask(project.id, payload);
            const task = created?.data ?? created;
            notifyProjectsChanged();
            onRefresh?.();
            onClose?.();
            if (task?.id) navigate(`/projects/${project.id}/tasks/${task.id}`);
        } catch (failure) {
            setError(failure.message);
        } finally {
            setBusy(false);
        }
    }

    return <form className="projects-form" onSubmit={submit} aria-label="Add New Task">
        <div className="projects-field">
            <label className="projects-field-label" htmlFor="projects-task-title">Title</label>
            <div className="projects-field-body"><input id="projects-task-title" value={form.title} maxLength={200} required onChange={event => update('title', event.target.value)} /></div>
        </div>
        <div className="projects-field">
            <label className="projects-field-label" htmlFor="projects-task-description">Description</label>
            <div className="projects-field-body"><textarea id="projects-task-description" rows={4} value={form.description} onChange={event => update('description', event.target.value)} /></div>
        </div>
        <div className="projects-grid-2">
            <div className="projects-field">
                <label className="projects-field-label" htmlFor="projects-task-priority">Priority</label>
                <div className="projects-field-body"><select id="projects-task-priority" value={form.priority_id} onChange={event => update('priority_id', event.target.value)}>
                    {options.map(option => <option key={option.name} value={option.id ?? ''} disabled={option.id === null}>{priorityLabel(option)}</option>)}
                </select></div>
            </div>
            <div className="projects-field">
                <label className="projects-field-label" htmlFor="projects-task-status">Status</label>
                <div className="projects-field-body"><select id="projects-task-status" value={form.status} onChange={event => update('status', event.target.value)}>
                    {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select></div>
            </div>
        </div>
        <div className="projects-field">
            <label className="projects-field-label" htmlFor="projects-task-assignee">Assignee</label>
            <div className="projects-field-body"><select id="projects-task-assignee" value={form.assignee_id} disabled={!canManage} onChange={event => update('assignee_id', event.target.value)}>
                <option value="">{canManage ? 'Belum ditugaskan' : 'Ditentukan Project Manager'}</option>
                {members.map(member => <option key={member.user_id} value={member.user_id}>{member.user?.name}</option>)}
            </select></div>
            {!canManage && <p className="projects-assignee-note">Hanya Project Manager yang dapat mengatur assignee task.</p>}
        </div>
        <div className="projects-field">
            <span className="projects-field-label">Due Date</span>
            <div className="projects-field-body projects-calendar-body">
                <CalendarPicker value={form.due_date} onChange={value => update('due_date', value)} id="projects-task-calendar" />
            </div>
        </div>
        {error && <p className="projects-error" role="alert">{error}</p>}
        <div className="projects-form-actions">
            <button type="submit" className="projects-primary" disabled={busy}>Add Task</button>
            <button type="button" className="projects-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
    </form>;
}

export function ProjectDetail({ project, tasks, members, activities, priorities, user, canManage, navigate, onRefresh }) {
    const [tab, setTab] = useState('project-info');
    const [addingTask, setAddingTask] = useState(false);

    useEffect(() => setTab('project-info'), [project.id]);

    const tabs = [
        { id: 'project-info', label: 'Project Info' },
        { id: 'project-activity', label: 'Project Activity' },
        { id: 'project-setting', label: 'Project Setting' },
    ];

    return <>
        <ProjectTabs items={tabs} active={tab} onChange={setTab} />
        <div className="projects-panel" id={`projects-panel-${tab}`} role="tabpanel" aria-labelledby={`projects-tab-${tab}`}>
            {tab === 'project-info' && <ProjectInfoTab
                project={project}
                tasks={tasks}
                priorities={priorities}
                navigate={navigate}
                onAddTask={() => setAddingTask(true)}
            />}
            {tab === 'project-activity' && <ActivityTab activities={activities} />}
            {tab === 'project-setting' && <SettingsTab project={project} members={members} canManage={canManage} navigate={navigate} onRefresh={onRefresh} />}
        </div>
        {addingTask && <Modal title="Add New Task" onClose={() => setAddingTask(false)} labelledBy="projects-add-task-title">
            <CreateTaskForm
                project={project}
                members={members}
                priorities={priorities}
                canManage={canManage}
                navigate={navigate}
                onRefresh={onRefresh}
                onClose={() => setAddingTask(false)}
            />
        </Modal>}
    </>;
}

export { projectDeadline };
