import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../../resources/js/pages/projects/ProjectsPage.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const staff = { id: 2, name: 'Dewi Anggraini', roles: ['staff'] };

const projects = [
    { id: 1, name: 'Google Vendor', description: 'Vendor Google', created_by_id: 1, created_at: '2026-09-18T08:00:00+00:00', members_count: 3, tasks_count: 2 },
    { id: 2, name: 'Aplikasi Mobile', description: 'Aplikasi internal', created_by_id: 4, created_at: '2026-09-10T08:00:00+00:00', members_count: 2, tasks_count: 1 },
];

const users = [
    { id: 1, name: 'Fulan bin Fulan', roles: ['manager'] },
    { id: 2, name: 'Dewi Anggraini', roles: ['staff'] },
    { id: 3, name: 'Eka Prasetyo', roles: ['staff'] },
    { id: 4, name: 'Rina Wulandari', roles: ['manager'] },
];

const priorities = [
    { id: 1, name: 'low', level: 1 },
    { id: 2, name: 'medium', level: 2 },
    { id: 3, name: 'high', level: 3 },
];

const tasksByProject = {
    1: [
        {
            id: 11, project_id: 1, title: 'Fiksasi Tim', description: '—', status: 'in_progress',
            priority_id: 3, priority: { id: 3, name: 'high' }, due_date: null,
            created_by_id: 1, creator: { id: 1, name: 'Fulan bin Fulan' },
            assignee_id: 2, assignee: { id: 2, name: 'Dewi Anggraini' },
            assignees: [{ id: 2, name: 'Dewi Anggraini' }], attachments: [],
        },
        {
            id: 12, project_id: 1, title: 'Memorandum', description: '—', status: 'done',
            priority_id: 2, priority: { id: 2, name: 'medium' }, due_date: null,
            created_by_id: 1, creator: { id: 1, name: 'Fulan bin Fulan' },
            assignee_id: null, assignee: null, assignees: [], attachments: [],
        },
    ],
    2: [
        {
            id: 21, project_id: 2, title: 'Desain UI', description: '—', status: 'todo',
            priority_id: 1, priority: { id: 1, name: 'low' }, due_date: null,
            created_by_id: 4, creator: { id: 4, name: 'Rina Wulandari' },
            assignee_id: 3, assignee: { id: 3, name: 'Eka Prasetyo' },
            assignees: [{ id: 3, name: 'Eka Prasetyo' }], attachments: [],
        },
    ],
};

function respond(data, status = 200) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
}

function paged(rows) {
    return { data: rows, links: { next: null } };
}

function setup() {
    const fetchMock = vi.fn((url, options = {}) => {
        const method = (options.method ?? 'GET').toUpperCase();
        const path = String(url).split('?')[0];
        switch (`${method} ${path}`) {
            case 'GET /projects':
                return respond(paged(projects));
            case 'GET /priorities':
                return respond({ data: priorities });
            case 'GET /users':
                return respond(paged(users));
            case 'GET /projects/1/tasks':
                return respond(paged(tasksByProject[1]));
            case 'GET /projects/2/tasks':
                return respond(paged(tasksByProject[2]));
            case 'GET /tasks/11':
                return respond({ data: tasksByProject[1][0] });
            default:
                return respond({ data: [] });
        }
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

async function openMyTasks() {
    render(<ProjectsPage user={staff} path="/projects?view=tasks" />);
    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    await screen.findByText('Fiksasi Tim');
}

function rows() {
    return screen.queryAllByTestId('task-card').map(card => card.querySelector('h3').textContent);
}

it('shows the task filter bar in Figma order on the My Tasks page', async () => {
    setup();
    await openMyTasks();

    expect(screen.getByRole('group', { name: 'Filter task' })).toBeInTheDocument();
    const bar = screen.getByRole('group', { name: 'Filter task' });
    expect(within(bar).getAllByRole('button').map(button => button.textContent.replace('›', '').trim())).toEqual([
        'Assigned to me', 'Created by', 'All Projects', 'Any Priority', 'Any Status', 'Assigned to',
    ]);
    expect(rows()).toEqual(['Fiksasi Tim', 'Memorandum', 'Desain UI']);
});

it('filters to tasks assigned to the current user', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: 'Assigned to me' }));

    expect(screen.getByRole('button', { name: 'Assigned to me' })).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toEqual(['Fiksasi Tim']);
});

it('searches project managers before filtering tasks by creator', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: /Created by/ }));
    const dialog = screen.getByRole('dialog', { name: 'Created by' });
    // Opsi default mengikuti pola "All Projects": label tombolnya sendiri.
    expect(within(dialog).getByRole('option', { name: /Created by/ })).toHaveAttribute('aria-selected', 'true');
    // Sebelum mengetik, seluruh project manager tampil dan staff tidak ikut.
    expect(within(dialog).getByRole('option', { name: 'Fulan bin Fulan' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'Rina Wulandari' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: 'Dewi Anggraini' })).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('Search project manager'), { target: { value: 'rina' } });
    expect(within(dialog).getByRole('option', { name: 'Rina Wulandari' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: 'Fulan bin Fulan' })).toBeNull();

    fireEvent.click(within(dialog).getByRole('option', { name: 'Rina Wulandari' }));

    expect(screen.getByRole('button', { name: /Rina Wulandari/ })).toBeInTheDocument();
    expect(rows()).toEqual(['Desain UI']);

    // Kembali ke default tanpa filter lewat opsi "Created by".
    fireEvent.click(screen.getByRole('button', { name: /Rina Wulandari/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Rina Wulandari/ })).getByRole('option', { name: /Created by/ }));
    expect(rows()).toEqual(['Fiksasi Tim', 'Memorandum', 'Desain UI']);
});

it('filters tasks by selected project', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: /All Projects/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'All Projects' })).getByRole('option', { name: 'Aplikasi Mobile' }));

    expect(rows()).toEqual(['Desain UI']);
    expect(screen.getByRole('button', { name: /Aplikasi Mobile/ })).toBeInTheDocument();
});

it('filters tasks by priority from the dropdown', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: /Any Priority/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Any Priority' })).getByRole('option', { name: 'High' }));

    expect(rows()).toEqual(['Fiksasi Tim']);
});

it('filters tasks by status from the dropdown', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: /Any Status/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Any Status' })).getByRole('option', { name: 'Finished' }));

    expect(rows()).toEqual(['Memorandum']);
});

it('lists every task of the selected assignee across projects', async () => {
    setup();
    await openMyTasks();

    fireEvent.click(screen.getByRole('button', { name: 'Assigned to' }));
    const dialog = screen.getByRole('dialog', { name: 'Assigned to' });
    expect(within(dialog).getByRole('option', { name: /Assigned to/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(within(dialog).getByLabelText('Search assignee'), { target: { value: 'eka' } });
    fireEvent.click(within(dialog).getByRole('option', { name: 'Eka Prasetyo' }));

    expect(rows()).toEqual(['Desain UI']);
    expect(screen.getByRole('button', { name: /Eka Prasetyo/ })).toBeInTheDocument();

    // Opsi default mengembalikan seluruh task lintas project.
    fireEvent.click(screen.getByRole('button', { name: /Eka Prasetyo/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Eka Prasetyo/ })).getByRole('option', { name: /Assigned to/ }));
    expect(rows()).toEqual(['Fiksasi Tim', 'Memorandum', 'Desain UI']);
});

it('keeps the search term from the URL applied to the task list', async () => {
    setup();
    render(<ProjectsPage user={staff} path="/projects?view=tasks&q=memorandum" />);

    await screen.findByText('Memorandum');
    await waitFor(() => expect(rows()).toEqual(['Memorandum']));
});

it('hides Create New Project on the Teams page but keeps it on the project list', async () => {
    setup();
    const manager = { id: 1, name: 'Fulan bin Fulan', roles: ['manager'] };
    const { unmount } = render(<ProjectsPage user={manager} path="/projects?view=teams" />);

    await screen.findByRole('heading', { name: 'Teams', level: 1 });
    expect(screen.queryByRole('button', { name: 'Create New Project' })).toBeNull();
    unmount();

    render(<ProjectsPage user={manager} path="/projects" />);
    await screen.findByRole('heading', { name: 'Project', level: 1 });
    expect(await screen.findByRole('button', { name: 'Create New Project' })).toBeInTheDocument();
});

it('shows the filter bar on the My Tasks detail page and opens the filtered list', async () => {
    setup();
    render(<ProjectsPage user={staff} path="/projects/1/tasks/11?view=mytask" />);

    await screen.findByRole('heading', { name: 'My Tasks → Fiksasi Tim', level: 1 });
    await screen.findByRole('heading', { name: 'Fiksasi Tim', level: 2 });
    expect(screen.getByRole('group', { name: 'Filter task' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Assigned to me' }));

    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    await waitFor(() => expect(rows()).toEqual(['Fiksasi Tim']));
});

it('puts a Go to Task Details button at the bottom of each task card', async () => {
    setup();
    await openMyTasks();

    const cards = screen.getAllByTestId('task-card');
    expect(cards).toHaveLength(3);
    cards.forEach(card => expect(within(card).getByRole('button', { name: 'Go to Task Details' })).toBeInTheDocument());

    const push = vi.spyOn(window.history, 'pushState');
    const card = cards.find(node => node.textContent.includes('Fiksasi Tim'));
    fireEvent.click(within(card).getByRole('button', { name: 'Go to Task Details' }));

    // Langsung ke tab Task Info (tanpa ?view=mytask).
    expect(push).toHaveBeenCalledWith({}, '', '/projects/1/tasks/11');
});
