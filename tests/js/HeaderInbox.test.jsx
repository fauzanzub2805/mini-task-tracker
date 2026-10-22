import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it } from 'vitest';
import { HeaderInbox } from '../../resources/js/pages/dashboard/HeaderInbox.jsx';

afterEach(cleanup);
const item = { id: 10, recipientId: 1, title: 'Task baru', body: 'Silakan review', readAt: null };

it('links the chat icon to Profile > Message and shows the real unread count', () => {
    render(<HeaderInbox userId={1} chatUnread={4} />);
    const chat = screen.getByRole('link', { name: 'Chat, 4 belum dibaca' });
    expect(chat).toHaveAttribute('href', '/profile/messages');
    expect(chat.querySelector('.dashboard-unread-count')).toHaveTextContent('4');
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
});

it('opens the notification popup without a chat popup and marks items read', () => {
    render(<HeaderInbox userId={1} notifications={[item]} />);
    const notifications = screen.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' });
    fireEvent.click(notifications);
    expect(screen.getByRole('heading', { name: 'Notifikasi' })).toBeVisible();
    expect(screen.getByText('Task baru')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    expect(notifications).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tutup Notifikasi' }));
    expect(notifications).toHaveAttribute('aria-expanded', 'false');
    expect(notifications).toHaveFocus();
});

it('ignores other recipients, read items and the guest state', () => {
    const { rerender } = render(<HeaderInbox userId={1} notifications={[{ ...item, readAt: '2026-10-21' }, { ...item, id: 11, recipientId: 2 }]} chatUnread={0} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Chat' })).not.toHaveTextContent('4');

    rerender(<HeaderInbox userId={1} notifications={[item]} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(1);

    rerender(<HeaderInbox userId={null} notifications={[item]} chatUnread={7} />);
    expect(document.querySelectorAll('.dashboard-unread-dot')).toHaveLength(0);
    expect(screen.queryByText('Task baru')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat, 7 belum dibaca' })).toBeInTheDocument();
});

it('closes the notification popup on Escape and outside click', () => {
    render(<HeaderInbox userId={1} notifications={[item]} />);
    const trigger = screen.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
