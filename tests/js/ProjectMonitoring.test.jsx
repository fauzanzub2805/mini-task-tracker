import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectMonitoring } from '../../resources/js/pages/dashboard/ProjectMonitoring.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const json = body => Promise.resolve({ ok: true, json: async () => body });

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

it('shows fetch errors instead of silently replacing real data with demo rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 })));
    render(<ProjectMonitoring userId={1} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi berakhir');
    expect(screen.queryByText('Fiksasi Tim Google')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});
