import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../../resources/js/pages/projects/ProjectsPage.jsx';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const manager = { id: 1, name: 'Fulan bin Fulan', roles: ['manager'] };
const staff = { id: 2, name: 'Dewi Anggraini', roles: ['staff'] };

const baseProjects = [
    { id: 1, name: 'Google Vendor', description: 'Penyusunan dan pengembangan model AI untuk search engine Google', created_by_id: 1, created_at: '2026-09-18T08:00:00+00:00', members_count: 3, tasks_count: 2 },
    { id: 2, name: 'Ai for PT.Bukaka', description: 'Perancangan model Ai Corporate', created_by_id: 3, created_at: '2026-09-10T08:00:00+00:00', members_count: 1, tasks_count: 1 },
    { id: 3, name: 'Project Rurumas', description: null, created_by_id: 1, created_at: '2026-09-01T08:00:00+00:00', members_count: 0, tasks_count: 0 },
];

const priorities = [
    { id: 1, name: 'low', level: 1 },
    { id: 2, name: 'medium', level: 2 },
    { id: 3, name: 'high', level: 3 },
    { id: 4, name: 'urgent', level: 4 },
];

const members = [
    { user_id: 1, user: { id: 1, name: 'Fulan bin Fulan' }, role: { id: 1, name: 'manager' } },
    { user_id: 2, user: { id: 2, name: 'Dewi Anggraini' }, role: { id: 2, name: 'staff' } },
    { user_id: 3, user: { id: 3, name: 'Eka Prasetyo' }, role: { id: 2, name: 'staff' } },
];

const baseTasks = [
    { id: 11, project_id: 1, title: 'Fiksasi Tim Google', description: 'Melakukan fiksasi tim yang akan handle project vendor untuk Google', status: 'in_progress', priority_id: 3, priority: { id: 3, name: 'high' }, due_date: '2026-09-18', assignee_id: 2, assignee: { id: 2, name: 'Dewi Anggraini' }, attachments: [] },
    { id: 12, project_id: 1, title: 'Memorandum', description: 'Menyusun memorandum untuk perancangan alur kerja project vendor', status: 'done', priority_id: 4, priority: { id: 4, name: 'urgent' }, due_date: '2026-09-20', assignee_id: null, assignee: null, attachments: [] },
];

const project1 = { id: 1, name: 'Google Vendor', description: 'Penyusunan dan pengembangan model AI untuk search engine Google', created_by_id: 1, created_at: '2026-09-18T08:00:00+00:00', members_count: 3, tasks_count: 2 };

const activities = [
    { id: 1, project_id: 1, user: { id: 1, name: 'Fulan bin Fulan' }, action: 'project.created', description: 'membuat project "Google Vendor"', created_at: '2026-09-18T09:00:00+00:00' },
    { id: 2, project_id: 1, task_id: 11, user: { id: 2, name: 'Dewi Anggraini' }, action: 'task.updated', description: 'memperbarui task "Fiksasi Tim Google"', created_at: '2026-09-18T09:30:00+00:00' },
];

const directory = [
    { id: 1, name: 'Fulan bin Fulan', roles: ['manager'] },
    { id: 2, name: 'Dewi Anggraini', roles: ['staff'] },
    { id: 3, name: 'Eka Prasetyo', roles: ['staff'] },
    { id: 4, name: 'Rina Wulandari', roles: ['staff'] },
];

const baseComments = [
    { id: 1, task_id: 11, author_id: 2, author: { id: 2, name: 'Dewi Anggraini' }, body: 'Dokumennya kurang lengkap', created_at: '2026-09-18T09:17:00+00:00' },
];

function paged(rows) {
    return { data: rows, links: { next: null } };
}

function respond(data, status = 200) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
}

function setup() {
    const state = {
        taskTitle: baseTasks[0].title,
        attachments: [],
        projectName: project1.name,
        lastPatch: null,
        lastComment: null,
        lastMember: null,
        lastTaskCreate: null,
        uploadedFiles: null,
        deletedAttachment: null,
    };

    const taskDetail = () => ({ ...baseTasks[0], title: state.taskTitle, assignees: [{ id: 2, name: 'Dewi Anggraini' }], attachments: state.attachments });

    const fetchMock = vi.fn((url, options = {}) => {
        const method = (options.method ?? 'GET').toUpperCase();
        const path = String(url).split('?')[0];
        const key = `${method} ${path}`;

        switch (key) {
            case 'GET /projects':
                return respond(paged(baseProjects));
            case 'GET /priorities':
                return respond({ data: priorities });
            case 'GET /projects/1':
                return respond({ data: { ...project1, name: state.projectName } });
            case 'GET /projects/1/tasks':
                return respond(paged(baseTasks));
            case 'GET /projects/1/members':
                return respond(paged(members));
            case 'GET /projects/1/activities':
                return respond(paged(activities));
            case 'GET /tasks/11':
                return respond({ data: taskDetail() });
            case 'GET /tasks/11/comments':
                return respond(paged(baseComments));
            case 'GET /users':
                return respond(paged(directory));
            case 'POST /projects/1/members':
                state.lastMember = JSON.parse(options.body);
                return respond({ data: { user_id: state.lastMember.user_id, role: { id: state.lastMember.role_id, name: 'staff' } } }, 201);
            case 'POST /projects/1/tasks':
                state.lastTaskCreate = JSON.parse(options.body);
                return respond({ data: { title: state.lastTaskCreate.title } }, 201);
            case 'PATCH /tasks/11':
                state.lastPatch = JSON.parse(options.body);
                return respond({ data: { ...taskDetail(), ...state.lastPatch } });
            case 'POST /tasks/11/attachments':
                state.uploadedFiles = options.body.getAll('files[]').map(file => file.name);
                return respond({ data: [] }, 201);
            case 'POST /tasks/11/comments':
                state.lastComment = JSON.parse(options.body);
                return respond({ data: { id: 2, task_id: 11, author_id: 1, author: { id: 1, name: 'Fulan bin Fulan' }, body: state.lastComment.body, created_at: '2026-09-18T10:00:00+00:00' } }, 201);
            case 'POST /projects':
                return respond({ data: { id: 9, name: JSON.parse(options.body).name, description: JSON.parse(options.body).description } }, 201);
            default:
                return Promise.reject(new Error(`Unexpected request: ${key}`));
        }
    });

    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, state };
}

it('renders project cards, filters by search, sorts, and opens the create form', async () => {
    setup();
    render(<ProjectsPage user={manager} path="/projects" />);

    expect(await screen.findByText('Google Vendor')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Insert Image' })).toHaveLength(3);
    expect(screen.getByText('(No detailed information of project)')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a project' }), { target: { value: 'bukaka' } });
    expect(screen.queryByText('Google Vendor')).toBeNull();
    expect(screen.getByText('Ai for PT.Bukaka')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a project' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Urutkan project' }));
    fireEvent.click(screen.getByRole('option', { name: /Alphabet \(A-Z\)/ }));
    expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)[0]).toBe('Ai for PT.Bukaka');

    fireEvent.click(screen.getByRole('button', { name: 'Create New Project' }));
    expect(screen.getByRole('dialog', { name: 'Create New Project' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Project Baru' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create New Project' })).toBeNull());
});

it('shows project tasks with priority and status, and switches to activity and settings', async () => {
    setup();
    render(<ProjectsPage user={manager} path="/projects/1" />);

    expect(await screen.findByRole('heading', { name: 'Google Vendor' })).toBeInTheDocument();
    expect(screen.getByText('Project Deadline : 20 September 2026')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    expect(screen.getByText('Finished')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Project Activity' }));
    expect(await screen.findByText(/membuat project/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Project Setting' }));
    expect(screen.getByLabelText('Project Name')).toHaveValue('Google Vendor');
});

it('uses a functional calendar and saves the edited task', async () => {
    const { state } = setup();
    const changed = vi.fn();
    window.addEventListener('projects:changed', changed);
    render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);

    const title = await screen.findByDisplayValue('Fiksasi Tim Google');
    expect(await screen.findByText('September 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('gridcell', { name: '5 October 2026' }));

    fireEvent.change(title, { target: { value: 'Fiksasi Tim Google (revisi)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(state.lastPatch).not.toBeNull());
    expect(state.lastPatch).toMatchObject({ title: 'Fiksasi Tim Google (revisi)', due_date: '2026-10-05' });
    await waitFor(() => expect(changed).toHaveBeenCalled());
    window.removeEventListener('projects:changed', changed);
});

it('rejects files above 10 MB and uploads multiple accepted files', async () => {
    const { state } = setup();
    render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);

    await screen.findByDisplayValue('Fiksasi Tim Google');
    const input = screen.getByLabelText('Choose file');

    const big = new File(['big'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByRole('alert')).toHaveTextContent('melebihi batas 10 MB per file');

    fireEvent.change(input, { target: { files: [new File(['a'], 'satu.png'), new File(['b'], 'dua.pdf')] } });
    expect(screen.getByText('satu.png, dua.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(state.uploadedFiles).toEqual(['satu.png', 'dua.pdf']));
});

it('only lets a project manager add assignees', async () => {
    setup();
    const { unmount } = render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);
    await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.click(screen.getByRole('button', { name: /Dewi Anggraini/ }));
    expect(screen.getByText(/Add more staff for the task in this project/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambahkan Eka Prasetyo' })).toBeInTheDocument();
    unmount();

    render(<ProjectsPage user={staff} path="/projects/1/tasks/11" />);
    await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.click(screen.getByRole('button', { name: /Dewi Anggraini/ }));
    expect(screen.getByText('Hanya Project Manager yang dapat mengubah assignee task ini.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tambahkan / })).toBeNull();
});

it('renders comments in their own tab and sends @mentions of project members', async () => {
    const { state } = setup();
    render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);

    await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    const comment = await screen.findByText('Dokumennya kurang lengkap');
    const bubble = comment.closest('.projects-comment-bubble');
    expect(bubble).not.toBeNull();
    expect(bubble.closest('.projects-comment').querySelector('.projects-comment-avatar')).toHaveAttribute('role', 'img');
    expect(bubble.closest('.projects-comment').querySelector('.projects-comment-avatar')).not.toBeEmptyDOMElement();
    expect(bubble.querySelector('time')).toBeNull();
    expect(bubble.parentElement.querySelector('.projects-comment-meta time')).toBeInTheDocument();

    const composer = screen.getByRole('textbox', { name: 'Tulis komentar' });
    expect(composer).toHaveAttribute('rows', '1');
    expect(composer.parentElement).toContainElement(screen.getByRole('button', { name: 'Sisipkan mention' }));
    expect(composer.parentElement).not.toContainElement(screen.getByRole('button', { name: 'Kirim komentar' }));
    fireEvent.change(composer, { target: { value: 'Halo @Ek' } });
    fireEvent.click(await screen.findByRole('option', { name: /Eka Prasetyo/ }));
    expect(composer).toHaveValue('Halo @Eka Prasetyo ');

    fireEvent.click(screen.getByRole('button', { name: 'Kirim komentar' }));
    await waitFor(() => expect(state.lastComment).not.toBeNull());
    expect(state.lastComment).toEqual({ body: 'Halo @Eka Prasetyo', mention_ids: [3] });
});

it('refreshes on focus without overwriting a dirty draft', async () => {
    const { state, fetchMock } = setup();
    render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);

    const title = await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.change(title, { target: { value: 'Draft lokal' } });

    state.taskTitle = 'Judul dari server';
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/tasks/11').length).toBeGreaterThan(1));
    expect(title).toHaveValue('Draft lokal');
});

it('hides project creation from staff', async () => {
    setup();
    render(<ProjectsPage user={staff} path="/projects" />);

    expect(await screen.findByText('Google Vendor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create New Project' })).toBeNull();
});

it('lets a project manager add an existing user to the project', async () => {
    const { state } = setup();
    render(<ProjectsPage user={manager} path="/projects/1" />);

    await screen.findByRole('heading', { name: 'Google Vendor' });
    fireEvent.click(screen.getByRole('tab', { name: 'Project Setting' }));

    const select = await screen.findByLabelText('Add existing user');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Rina Wulandari' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Dewi Anggraini' })).toBeNull();

    fireEvent.change(select, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }));

    await waitFor(() => expect(state.lastMember).toEqual({ user_id: 4, role_id: 2 }));
    expect(await screen.findByText('Anggota ditambahkan ke project.')).toBeInTheDocument();
});

it('disables the create-task assignee selector when the user cannot manage the project', async () => {
    const { state } = setup();
    const { unmount } = render(<ProjectsPage user={manager} path="/projects/1" />);

    await screen.findByRole('heading', { name: 'Google Vendor' });
    fireEvent.click(screen.getByRole('button', { name: 'Add New Task' }));
    expect(screen.getByLabelText('Assignee')).toBeEnabled();
    unmount();

    render(<ProjectsPage user={staff} path="/projects/1" />);
    await screen.findByRole('heading', { name: 'Google Vendor' });
    fireEvent.click(screen.getByRole('button', { name: 'Add New Task' }));
    expect(screen.getByLabelText('Assignee')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Task dari staff' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => expect(state.lastTaskCreate).not.toBeNull());
    expect(state.lastTaskCreate).not.toHaveProperty('assignee_id');
});

it('does not offer comment deletion', async () => {
    setup();
    render(<ProjectsPage user={staff} path="/projects/1/tasks/11" />);

    await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(await screen.findByText('Dokumennya kurang lengkap')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
});

it('shows only task-specific activity on the task activity tab', async () => {
    setup();
    render(<ProjectsPage user={manager} path="/projects/1/tasks/11" />);

    await screen.findByDisplayValue('Fiksasi Tim Google');
    fireEvent.click(screen.getByRole('tab', { name: 'Project Activity' }));

    expect(await screen.findByText(/memperbarui task/)).toBeInTheDocument();
    expect(screen.queryByText(/membuat project/)).toBeNull();
});

it('keeps settings drafts when polling refreshes the project', async () => {
    const { state, fetchMock } = setup();
    render(<ProjectsPage user={manager} path="/projects/1" />);

    await screen.findByRole('heading', { name: 'Google Vendor' });
    fireEvent.click(screen.getByRole('tab', { name: 'Project Setting' }));
    const name = screen.getByLabelText('Project Name');
    fireEvent.change(name, { target: { value: 'Draft Nama Project' } });

    state.projectName = 'Google Vendor (server)';
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/projects/1').length).toBeGreaterThan(1));
    expect(name).toHaveValue('Draft Nama Project');
});
