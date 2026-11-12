import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { KanbanBoard } from '../../resources/js/pages/kanban/KanbanBoard.jsx';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const projects = [
    { id: 1, name: 'Google Vendor' },
    { id: 2, name: 'Aplikasi Mobile' },
];

const priorities = [
    { id: 1, name: 'low', level: 1 },
    { id: 2, name: 'medium', level: 2 },
    { id: 3, name: 'high', level: 3 },
];

const users = [
    { id: 1, name: 'Fulan bin Fulan', roles: ['manager'] },
    { id: 2, name: 'Dewi Anggraini', roles: ['staff'] },
];

function task(overrides) {
    return {
        id: 11, project_id: 1, title: 'Revisi Fitur', description: '', status: 'todo',
        priority_id: 3, priority: { id: 3, name: 'high' }, due_date: null, attachments: [],
        created_by_id: 1, creator: { id: 1, name: 'Fulan bin Fulan' },
        assignee_id: 2, assignee: { id: 2, name: 'Dewi Anggraini' },
        assignees: [{ id: 2, name: 'Dewi Anggraini' }], comments_count: 2,
        ...overrides,
    };
}

const tasksByProject = {
    1: [
        task({ id: 11, title: 'Revisi Fitur', status: 'todo', comments_count: 2 }),
        task({ id: 12, title: 'Perbaikan Alur', status: 'in_progress', comments_count: 2, priority: { id: 3, name: 'high' } }),
    ],
    2: [
        task({ id: 21, project_id: 2, title: 'Sinkronisasi Data', status: 'done', priority: { id: 1, name: 'low' }, comments_count: 0 }),
        task({ id: 22, project_id: 2, title: 'Uji Regresi', status: 'testing', comments_count: 5 }),
    ],
};

function respond(payload, status = 200) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => payload });
}

const paged = rows => ({ data: rows, links: { next: null } });

function setup() {
    const state = { patches: [] };
    // Salinan data agar PATCH benar-benar mengubah status yang dikembalikan server.
    const rows = {
        1: tasksByProject[1].map(row => ({ ...row })),
        2: tasksByProject[2].map(row => ({ ...row })),
    };
    const fetchMock = vi.fn((url, options = {}) => {
        const method = (options.method ?? 'GET').toUpperCase();
        const path = String(url).split('?')[0];
        switch (`${method} ${path}`) {
            case 'GET /projects': return respond(paged(projects));
            case 'GET /priorities': return respond({ data: priorities });
            case 'GET /users': return respond(paged(users));
            case 'GET /projects/1/tasks': return respond(paged(rows[1]));
            case 'GET /projects/2/tasks': return respond(paged(rows[2]));
            case 'GET /projects/1': return respond({ data: projects[0] });
            case 'GET /projects/1/members': return respond(paged([]));
            case 'GET /projects/1/activities': return respond(paged([]));
            case 'GET /tasks/11': return respond({ data: rows[1].find(row => row.id === 11) });
            default:
                if (method === 'PATCH' && /^\/tasks\/\d+$/.test(path)) {
                    const id = Number(path.split('/').pop());
                    const body = JSON.parse(options.body);
                    state.patches.push({ path, body: options.body });
                    Object.values(rows).flat().forEach(row => {
                        if (row.id === id) Object.assign(row, body);
                    });
                    return respond({ data: {} });
                }
                return respond(paged([]));
        }
    });
    vi.stubGlobal('fetch', fetchMock);
    return state;
}

function transfer() {
    const store = new Map();
    return {
        effectAllowed: '',
        dropEffect: '',
        setData: (type, value) => store.set(type, value),
        getData: type => store.get(type) ?? '',
    };
}

async function renderBoard() {
    render(<KanbanBoard user={{ id: 2, name: 'Dewi Anggraini', roles: ['staff'] }} />);
    await screen.findByText('Revisi Fitur');
}

it('renders the five status columns in order with task counts', async () => {
    setup();
    await renderBoard();

    const columns = screen.getAllByRole('region', { name: /task$/ });
    expect(columns.map(column => within(column).getAllByRole('heading')[0].textContent)).toEqual([
        'Open Task', 'In Progress', 'Finish Dev', 'Testing', 'Finished',
    ]);
    expect(screen.getByRole('region', { name: 'Open Task, 1 task' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'In Progress, 1 task' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Finish Dev, 0 task' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Testing, 1 task' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Finished, 1 task' })).toBeInTheDocument();
});

it('shows the shared filter bar without Any Status', async () => {
    setup();
    await renderBoard();

    const bar = screen.getByRole('group', { name: 'Filter task' });
    expect(within(bar).getAllByRole('button').map(button => button.textContent.replace('›', '').trim())).toEqual([
        'Assigned to me', 'Created by', 'All Projects', 'Any Priority', 'Assigned to',
    ]);
    expect(within(bar).queryByText('Any Status')).toBeNull();
});

it('shows priority, comment count and the creator avatar on each card', async () => {
    setup();
    await renderBoard();

    const card = screen.getByLabelText('Task Revisi Fitur');
    expect(within(card).getByText('High')).toBeInTheDocument();
    expect(within(card).getByLabelText('2 komentar')).toBeInTheDocument();
    // Avatar memakai inisial pembuat task (Project Manager) karena user belum punya foto.
    expect(within(card).getByText('FF')).toBeInTheDocument();
    expect(within(card).getByTitle('Fulan bin Fulan')).toBeInTheDocument();
});

it('moves a card to another status when dropped and saves it', async () => {
    const state = setup();
    await renderBoard();

    const card = screen.getByLabelText('Task Revisi Fitur');
    const target = screen.getByRole('region', { name: /^In Progress/ });
    const dataTransfer = transfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => expect(state.patches).toHaveLength(1));
    expect(state.patches[0].path).toBe('/tasks/11');
    expect(state.patches[0].body).toEqual(JSON.stringify({ status: 'in_progress' }));

    const inProgress = screen.getByRole('region', { name: /^In Progress/ });
    await waitFor(() => expect(within(inProgress).getByLabelText('Task Revisi Fitur')).toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Open Task, 0 task' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'In Progress, 2 task' })).toBeInTheDocument();
});

it('filters cards by priority through the shared bar', async () => {    setup();
    await renderBoard();

    fireEvent.click(screen.getByRole('button', { name: /Any Priority/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Any Priority' })).getByRole('option', { name: 'Low' }));

    expect(screen.queryByLabelText('Task Revisi Fitur')).toBeNull();
    expect(screen.getByLabelText('Task Sinkronisasi Data')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Open Task, 0 task' })).toBeInTheDocument();
});

it('opens the task detail page (My Tasks) when a card is clicked', async () => {
    window.history.replaceState({}, '', '/kanban');
    setup();
    render(<DashboardApp user={{ id: 2, name: 'Dewi Anggraini', roles: ['staff'] }} page="kanban" />);

    fireEvent.click(await screen.findByLabelText('Task Revisi Fitur'));

    expect(await screen.findByRole('heading', { name: 'My Tasks → Revisi Fitur', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/projects/1/tasks/11');
    expect(window.location.search).toBe('?view=mytask');
});
