import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
    expect(document.querySelector('.dashboard-avatar')).toHaveTextContent('D');
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
