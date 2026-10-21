import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it } from 'vitest';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

afterEach(cleanup);
const user = { id: 1, name: 'Dewi', roles: ['staff'] };
const item = { id: 10, recipientId: 1, title: 'Task baru', body: 'Silakan review', readAt: null };
it('opens and toggles working notification and chat panels without fake dots', () => {
    render(<DashboardApp user={user} />);
    const notifications = screen.getByRole('button', { name: 'Notifikasi' });
    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    fireEvent.click(notifications);
    expect(screen.getByText('Belum ada notifikasi.')).toBeVisible();
    fireEvent.click(chat);
    expect(screen.queryByText('Belum ada notifikasi.')).not.toBeInTheDocument();
    expect(screen.getByText('Belum ada pesan masuk.')).toBeVisible();
    fireEvent.click(chat);
    expect(chat).toHaveAttribute('aria-expanded', 'false');
});
it('shows separate unread dots for current user and removes them after marking read', () => {
    render(<DashboardApp user={user} notifications={[item]} messages={[{ ...item, id: 11, title: 'Halo' }]} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Chat, 1 belum dibaca' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chat, 1 belum dibaca' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
});
it('ignores other recipients and already read items and reacts to incoming data', () => {
    const { rerender } = render(<DashboardApp user={user} notifications={[{ ...item, readAt: '2026-10-21' }]} messages={[{ ...item, recipientId: 2 }]} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    rerender(<DashboardApp user={user} notifications={[item]} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(1);
    rerender(<DashboardApp user={{ ...user, id: 2 }} notifications={[item]} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));
    expect(screen.queryByText('Task baru')).not.toBeInTheDocument();
});
it('closes on Escape, outside click and close button', () => {
    render(<DashboardApp user={user} />);
    const chat = screen.getByRole('button', { name: 'Chat' });
    fireEvent.click(chat);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(chat).toHaveFocus();
    expect(chat).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chat);
    fireEvent.pointerDown(document.body);
    expect(chat).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chat);
    fireEvent.click(screen.getByRole('button', { name: 'Tutup Chat' }));
    expect(chat).toHaveFocus();
    expect(chat).toHaveAttribute('aria-expanded', 'false');
});
