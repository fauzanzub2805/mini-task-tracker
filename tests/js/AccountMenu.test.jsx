import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
});

const user = { id: 1, name: 'Budi Santoso', roles: ['manager'] };
const json = data => Promise.resolve({ ok: true, status: 200, json: async () => data });

function setup() {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: [], links: { next: null } })));
    window.history.replaceState({}, '', '/dashboard');
    render(<DashboardApp user={user} page="dashboard" />);
}

it('opens an account menu with Profile and Logout from the header avatar', async () => {
    setup();

    const trigger = screen.getByRole('button', { name: 'Buka menu akun' });
    expect(trigger).toHaveTextContent('BS');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu', { name: 'Menu akun' })).toBeNull();

    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Menu akun' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
});

it('goes to the Profile page from the account menu', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Buka menu akun' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Profile' }));

    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Menu akun' })).toBeNull();
});

it('asks for confirmation when Logout is chosen from the account menu', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Buka menu akun' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));

    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName('You are about to Logout');
    // Menu tertutup karena dialog konfirmasi mengambil alih fokus.
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Menu akun' })).toBeNull());
});

it('closes the account menu with Escape and on outside click', async () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'Buka menu akun' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Menu akun' })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: 'Menu akun' })).toBeNull();
});
