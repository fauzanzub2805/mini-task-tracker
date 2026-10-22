import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const user = { id: 1, name: 'Dewi Lestari', roles: ['staff'] };
const json = data => Promise.resolve({ ok: true, status: 200, json: async () => data });

it('renders idle dashboard with clearly labeled demo data and disabled AI', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<DashboardApp />);
    expect(screen.getByRole('note')).toHaveTextContent('data contoh');
    expect(screen.getByRole('heading', { name: 'Welcome, Fulan!' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /AI Chatbot/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim ke AI belum tersedia' }));
    expect(fetch).not.toHaveBeenCalled();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6);
});

it('links both submenus to sections on the same page and supports collapse', () => {
    render(<DashboardApp />);
    const progress = screen.getByRole('link', { name: 'Progress Table' });
    expect(progress).toHaveAttribute('href', '#progress-table');
    expect(document.getElementById('progress-table')).toBeInTheDocument();
    fireEvent.click(progress);
    expect(progress).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'AI Chatbot' })).toHaveAttribute('href', '#ai-chatbot');
    const toggle = screen.getByRole('button', { name: /Dashboard/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Progress Table' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('link', { name: 'Progress Table' })).toBeInTheDocument();
});

it('uses authenticated name, role and initial instead of demo identity', () => {
    render(<DashboardApp user={{ name: 'Dewi Lestari', roles: ['staff'] }} />);
    expect(screen.getByText('Dewi Lestari')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(document.querySelector('.dashboard-avatar')).toHaveTextContent('DL');
    expect(screen.getByRole('heading', { name: 'Welcome, Dewi!' })).toBeInTheDocument();
    expect(screen.queryByText('Fulan bin Fulan')).toBeNull();
});

it('opens mobile navigation and closes it after section selection', () => {
    render(<DashboardApp />);
    const toggle = screen.getByRole('button', { name: 'Buka/tutup navigasi' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'AI Chatbot' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Projects/ })).toBeDisabled();
});

it('navigates from the sidebar to Profile and Message and back to Dashboard', () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: [], unread_count: 0 })));
    render(<DashboardApp user={user} page="profile" />);

    const profile = screen.getByRole('link', { name: 'Profile' });
    const message = screen.getByRole('link', { name: 'Message' });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).toHaveAttribute('aria-current', 'page');
    expect(message).toHaveAttribute('href', '/profile/messages');
    expect(screen.getByRole('link', { name: 'AI Chatbot' })).toHaveAttribute('href', '/dashboard#ai-chatbot');
    expect(screen.getByRole('link', { name: /Rekayasa/ })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('Dewi Lestari').length).toBeGreaterThan(0);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

it('shows the polled chat unread count on the header chat link', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: [], unread_count: 3 })));
    render(<DashboardApp user={user} page="messages" />);
    expect(await screen.findByRole('link', { name: 'Chat, 3 belum dibaca' })).toHaveAttribute('href', '/profile/messages');
});
