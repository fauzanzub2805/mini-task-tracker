import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectMonitoring } from '../../resources/js/pages/dashboard/ProjectMonitoring.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const json = body => Promise.resolve({ ok: true, json: async () => body });
const statCount = label => [...document.querySelectorAll('.dashboard-stat')]
    .find(element => element.querySelector('span')?.textContent === label)
    ?.querySelector('strong')?.textContent;

it('loads real tasks, members and subsequent pages and refreshes after mutations', async () => {
    let title = 'Existing task';
    const fetch = vi.fn(url => {
        if (url === '/projects') return json({ data: [{ id: 1, name: 'Dummy project' }], links: { next: '/projects?page=2' } });
        if (url === '/projects?page=2') return json({ data: [] });
        if (url.endsWith('/members')) return json({ data: [{ user: { name: 'Project lead' }, role: { name: 'manager' } }] });
        return json({ data: [{ id: 5, title, status: 'in_progress', assignees: [{ name: 'Dewi' }, { name: 'Eka' }] }] });
    });
    vi.stubGlobal('fetch', fetch);
    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('link', { name: /Existing task/ })).toHaveAttribute('href', '/projects/1/tasks/5');
    expect(screen.getByText('Dewi, Eka')).toBeInTheDocument();
    expect(screen.getByText('Project lead')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/projects?page=2', expect.any(Object));
    title = 'Changed task';
    fireEvent(window, new Event('projects:changed'));
    expect(await screen.findByRole('link', { name: /Changed task/ })).toBeInTheDocument();
});

it('polls changes from another client and stops polling after unmount', async () => {
    vi.useFakeTimers();
    let title = 'Before polling';
    const fetch = vi.fn(url => {
        if (url === '/projects') return json({ data: [{ id: 1, name: 'Project' }] });
        if (url.endsWith('/members')) return json({ data: [] });
        return json({ data: [{ id: 1, title, status: 'todo' }] });
    });
    vi.stubGlobal('fetch', fetch);
    const view = render(<ProjectMonitoring userId={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole('link', { name: /Before polling/ })).toBeInTheDocument();
    title = 'After polling';
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole('link', { name: /After polling/ })).toBeInTheDocument();
    view.unmount();
    const count = fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(fetch).toHaveBeenCalledTimes(count);
});

it('counts every task status accurately across projects', async () => {
    const tasks = {
        1: [{ id: 1, title: 'Todo A', status: 'todo' }, { id: 2, title: 'Dev A', status: 'finish_dev' }, { id: 3, title: 'Done A', status: 'done' }],
        2: [{ id: 4, title: 'Progress B', status: 'in_progress' }, { id: 5, title: 'Testing B', status: 'testing' }, { id: 6, title: 'Todo B', status: 'todo' }],
    };
    vi.stubGlobal('fetch', vi.fn(url => {
        if (url === '/projects') return json({ data: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }] });
        if (url.endsWith('/members')) return json({ data: [] });
        const id = url.match(/^\/projects\/(\d+)\/tasks/)?.[1];
        return json({ data: tasks[id] ?? [] });
    }));

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('link', { name: /Todo A/ })).toBeInTheDocument();

    expect(statCount('Open Task')).toBe('2');
    expect(statCount('In Progress')).toBe('1');
    expect(statCount('Finish Dev')).toBe('1');
    expect(statCount('Testing')).toBe('1');
    expect(statCount('Finished')).toBe('1');
    expect(screen.getByRole('link', { name: /Progress B/ })).toHaveAttribute('href', '/projects/2/tasks/4');
});

it('shows a loading state until the authorized data resolves', async () => {
    let resolveProjects;
    const projects = new Promise(resolve => { resolveProjects = resolve; });
    vi.stubGlobal('fetch', vi.fn(url => url === '/projects'
        ? projects
        : json({ data: [] })));

    render(<ProjectMonitoring userId={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('Memuat project dan task');
    expect(screen.queryByRole('link', { name: /Buka Projects/ })).not.toBeInTheDocument();

    resolveProjects({ ok: true, json: async () => ({ data: [] }) });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByRole('link', { name: 'Buka Projects' })).toHaveAttribute('href', '/projects');
});

it('shows an empty state and zero statistics when the user has no tasks', async () => {
    vi.stubGlobal('fetch', vi.fn(url => {
        if (url === '/projects') return json({ data: [{ id: 1, name: 'Empty project' }] });
        return json({ data: [] });
    }));

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByText(/Belum ada task/)).toBeInTheDocument();

    for (const status of ['Open Task', 'In Progress', 'Finish Dev', 'Testing', 'Finished']) {
        expect(statCount(status)).toBe('0');
    }
});

it('retries after a failed request and replaces the error with real data', async () => {
    const fetch = vi.fn();
    fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500 }))
        .mockImplementation(url => {
            if (url === '/projects') return json({ data: [{ id: 1, name: 'Recovered' }] });
            if (url.endsWith('/members')) return json({ data: [] });
            return json({ data: [{ id: 9, title: 'After retry', status: 'testing' }] });
        });
    vi.stubGlobal('fetch', fetch);

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Data monitoring belum dapat dimuat');

    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('link', { name: /After retry/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(statCount('Testing')).toBe('1');
});

it('shows fetch errors instead of silently replacing real data with demo rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 })));
    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi berakhir');
    expect(screen.queryByText('Fiksasi Tim Google')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});
