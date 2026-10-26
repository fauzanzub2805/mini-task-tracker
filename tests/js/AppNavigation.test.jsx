import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';
import { appPage } from '../../resources/js/lib/useAppNavigation.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });

it('navigates between app pages without replacing the sidebar or header and supports history', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
    window.history.replaceState({}, '', '/dashboard');
    render(<DashboardApp user={{ id: 1, name: 'Budi', roles: ['manager'] }} />);
    const sidebar = document.getElementById('dashboard-sidebar');
    const header = document.querySelector('.dashboard-header');
    fireEvent.click(within(sidebar).getByRole('link', { name: /^Projects/ }));
    expect(window.location.pathname).toBe('/projects');
    expect(await screen.findByRole('heading', { level: 1, name: 'Project' })).toBeInTheDocument();
    expect(document.getElementById('dashboard-sidebar')).toBe(sidebar);
    expect(document.querySelector('.dashboard-header')).toBe(header);
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Teams' }));
    expect(window.location.search).toBe('?view=teams');
    expect(await screen.findByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
    window.history.replaceState({}, '', '/dashboard#progress-table');
    fireEvent.popState(window);
    expect(await screen.findByRole('heading', { name: 'Welcome, Budi!' })).toBeInTheDocument();
    expect(document.querySelector('.dashboard-header')).toBe(header);
    expect(within(sidebar).getByRole('link', { name: 'Progress Table' })).toHaveAttribute('aria-current', 'location');
});

it('only recognizes page routes, not private downloads or auth routes', () => {
    expect(appPage('/projects/1/tasks/2')).toBe('projects');
    expect(appPage('/profile/messages')).toBe('messages');
    expect(appPage('/tasks/2/attachments/1')).toBeNull();
    expect(appPage('/projects/1/members')).toBeNull();
    expect(appPage('/login')).toBeNull();
    expect(appPage('/auth/logout')).toBeNull();
});
