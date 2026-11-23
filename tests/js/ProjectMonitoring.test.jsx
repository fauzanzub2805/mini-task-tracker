import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { MONITORING_POLL_MS, ProjectMonitoring } from '../../resources/js/pages/dashboard/ProjectMonitoring.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const statuses = ['todo', 'in_progress', 'finish_dev', 'testing', 'done'];
const project = { id: 1, name: 'Dummy project' };
/** Bentuk respons /dashboard/monitoring: ringkasan dihitung server dari baris yang sama. */
function snapshot(rows) {
    const summary = Object.fromEntries(statuses.map(status => [status, rows.filter(row => row.status === status).length]));
    return { summary, total: rows.length, data: rows.map(row => ({ project, assignees: [], managers: [], ...row })) };
}
const json = (body, etag = null) => Promise.resolve({ ok: true, status: 200, headers: { get: name => (name === 'ETag' ? etag : null) }, json: async () => body });
const notModified = () => Promise.resolve({ ok: false, status: 304 });
const statCount = label => [...document.querySelectorAll('.dashboard-stat')]
    .find(element => element.querySelector('span')?.textContent === label)
    ?.querySelector('strong')?.textContent;

it('loads tasks, assignees and managers from a single snapshot and refreshes after mutations', async () => {
    let title = 'Existing task';
    const fetch = vi.fn(() => json(snapshot([{
        id: 5, title, status: 'in_progress',
        assignees: [{ id: 1, name: 'Dewi' }, { id: 2, name: 'Eka' }],
        managers: [{ id: 3, name: 'Project lead' }],
    }])));
    vi.stubGlobal('fetch', fetch);
    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('link', { name: /Existing task/ })).toHaveAttribute('href', '/projects/1/tasks/5');
    expect(screen.getByRole('link', { name: 'Dummy project' })).toHaveAttribute('href', '/projects/1');
    expect(screen.getByText('Dewi, Eka')).toBeInTheDocument();
    expect(screen.getByText('Project lead')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/dashboard/monitoring', expect.any(Object));
    title = 'Changed task';
    fireEvent(window, new Event('projects:changed'));
    expect(await screen.findByRole('link', { name: /Changed task/ })).toBeInTheDocument();
});

it('polls changes from another client every few seconds and stops after unmount', async () => {
    vi.useFakeTimers();
    let status = 'todo';
    const fetch = vi.fn(() => json(snapshot([{ id: 1, title: 'Polled task', status }])));
    vi.stubGlobal('fetch', fetch);
    const view = render(<ProjectMonitoring userId={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(statCount('Open Task')).toBe('1');
    expect(statCount('Finished')).toBe('0');
    status = 'done';
    await act(async () => { await vi.advanceTimersByTimeAsync(MONITORING_POLL_MS); });
    // Angka ringkasan dan badge baris berubah bersamaan.
    expect(statCount('Open Task')).toBe('0');
    expect(statCount('Finished')).toBe('1');
    expect(document.querySelector('tbody .dashboard-badge')).toHaveTextContent('Finished');
    view.unmount();
    const count = fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(MONITORING_POLL_MS * 5); });
    expect(fetch).toHaveBeenCalledTimes(count);
});

it('revalidates with the ETag and keeps the current data on 304', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((url, options) => (options.headers['If-None-Match'] === '"v1"'
        ? notModified()
        : json(snapshot([{ id: 1, title: 'Cached task', status: 'testing' }]), '"v1"')));
    vi.stubGlobal('fetch', fetch);
    render(<ProjectMonitoring userId={1} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch.mock.calls[0][1].headers['If-None-Match']).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(MONITORING_POLL_MS); });
    expect(fetch.mock.calls[1][1].headers['If-None-Match']).toBe('"v1"');
    expect(screen.getByRole('link', { name: /Cached task/ })).toBeInTheDocument();
    expect(statCount('Testing')).toBe('1');
    expect(screen.queryByRole('alert')).toBeNull();
});

it('does not drop a change that arrives while a request is still in flight', async () => {
    const pending = [];
    const fetch = vi.fn(() => new Promise(resolve => { pending.push(resolve); }));
    vi.stubGlobal('fetch', fetch);
    const respond = (index, rows) => act(async () => {
        pending[index]({ ok: true, status: 200, json: async () => snapshot(rows) });
    });
    render(<ProjectMonitoring userId={1} />);
    // Perubahan terjadi saat muatan pertama belum selesai.
    fireEvent(window, new Event('projects:changed'));
    fireEvent(window, new Event('projects:changed'));
    expect(fetch).toHaveBeenCalledTimes(1);
    await respond(0, [{ id: 1, title: 'Stale task', status: 'todo' }]);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await respond(1, [{ id: 1, title: 'Fresh task', status: 'done' }]);
    expect(await screen.findByRole('link', { name: /Fresh task/ })).toBeInTheDocument();
    expect(statCount('Finished')).toBe('1');
    expect(fetch).toHaveBeenCalledTimes(2);
});

it('shows the server summary for every status across projects', async () => {
    const beta = { id: 2, name: 'Beta' };
    vi.stubGlobal('fetch', vi.fn(() => json(snapshot([
        { id: 1, title: 'Todo A', status: 'todo' }, { id: 2, title: 'Dev A', status: 'finish_dev' }, { id: 3, title: 'Done A', status: 'done' },
        { id: 4, title: 'Progress B', status: 'in_progress', project: beta }, { id: 5, title: 'Testing B', status: 'testing', project: beta }, { id: 6, title: 'Todo B', status: 'todo', project: beta },
    ]))));

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('link', { name: /Todo A/ })).toBeInTheDocument();

    expect(statCount('Open Task')).toBe('2');
    expect(statCount('In Progress')).toBe('1');
    expect(statCount('Finish Dev')).toBe('1');
    expect(statCount('Testing')).toBe('1');
    expect(statCount('Finished')).toBe('1');
    expect(screen.getByRole('link', { name: /Progress B/ })).toHaveAttribute('href', '/projects/2/tasks/4');
    expect(screen.getAllByText('Unassigned')).toHaveLength(6);
});

it('colors the task dot by project so it stays stable when rows reorder', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(snapshot([
        { id: 1, title: 'First', status: 'todo', project: { id: 7, name: 'perjalanan' } },
        { id: 2, title: 'Second', status: 'todo', project: { id: 7, name: 'perjalanan' } },
    ]))));
    render(<ProjectMonitoring userId={1} />);
    await screen.findByRole('link', { name: /First/ });
    const dots = [...document.querySelectorAll('tbody .task-dot')];
    expect(dots).toHaveLength(2);
    dots.forEach(dot => {
        expect(dot).toHaveClass('task-dot-2');
        expect(dot).toHaveTextContent('p');
    });
});

it('shows a loading state until the authorized data resolves', async () => {
    let resolveSnapshot;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveSnapshot = resolve; })));

    render(<ProjectMonitoring userId={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('Memuat project dan task');
    expect(screen.queryByRole('link', { name: /Buka Projects/ })).not.toBeInTheDocument();

    resolveSnapshot({ ok: true, status: 200, json: async () => snapshot([]) });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByRole('link', { name: 'Buka Projects' })).toHaveAttribute('href', '/projects');
});

it('shows an empty state and zero statistics when the user has no tasks', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(snapshot([]))));

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByText(/Belum ada task/)).toBeInTheDocument();

    for (const status of ['Open Task', 'In Progress', 'Finish Dev', 'Testing', 'Finished']) {
        expect(statCount(status)).toBe('0');
    }
});

it('retries after a failed request and replaces the error with real data', async () => {
    const fetch = vi.fn();
    fetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500 }))
        .mockImplementation(() => json(snapshot([{ id: 9, title: 'After retry', status: 'testing' }])));
    vi.stubGlobal('fetch', fetch);

    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Data monitoring belum dapat dimuat');
    expect(screen.getByText(/Sinkronisasi terputus/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('link', { name: /After retry/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(statCount('Testing')).toBe('1');
    expect(screen.getByText(/Tersinkron otomatis/)).toBeInTheDocument();
});

it('shows fetch errors instead of silently replacing real data with demo rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 })));
    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi berakhir');
    expect(screen.queryByText('Fiksasi Tim Google')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});
