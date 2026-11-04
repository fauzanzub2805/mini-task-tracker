import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveHeaderInbox } from '../../resources/js/pages/dashboard/LiveHeaderInbox.jsx';
import { notificationsApi } from '../../resources/js/lib/notificationsApi.js';

const item = { id: 8, recipientId: 1, title: 'Deadline task hari ini', body: 'Review design', url: '/projects/1/tasks/2', readAt: null, createdAt: '2030-05-15T00:00:00Z' };
const response = (items = [item], count = 1) => ({ data: items, unread_count: count, through_id: 8, next_before_id: null });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); document.head.innerHTML = ''; });

it('loads real unread count, links to the task, persists read state and handles bulk read', async () => {
    let result = response();
    vi.spyOn(notificationsApi, 'list').mockImplementation(async () => result);
    const read = vi.spyOn(notificationsApi, 'read').mockImplementation(async () => { result = response([{ ...item, readAt: '2030-05-15T00:01:00Z' }], 0); });
    const all = vi.spyOn(notificationsApi, 'readAll').mockResolvedValue(null);
    render(<LiveHeaderInbox userId={1} chatUnread={2} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifikasi, 1 belum dibaca' }));
    expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', item.url);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    await waitFor(() => expect(read).toHaveBeenCalledWith(8));
    await screen.findByRole('button', { name: 'Notifikasi' });
    expect(screen.queryByRole('button', { name: 'Tandai dibaca' })).toBeNull();
    result = response();
    fireEvent.focus(window);
    await screen.findByRole('button', { name: 'Notifikasi, 1 belum dibaca' });
    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua dibaca' }));
    await waitFor(() => expect(all).toHaveBeenCalledWith(8));
});

it('does not mark an alert read locally on mutation failure and offers retry', async () => {
    vi.spyOn(notificationsApi, 'list').mockResolvedValue(response());
    vi.spyOn(notificationsApi, 'read').mockRejectedValue(new Error('Sesi Anda berakhir.'));
    render(<LiveHeaderInbox userId={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifikasi, 1 belum dibaca' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesi Anda berakhir.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tandai dibaca' })).not.toBeDisabled());
    expect(screen.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' })).toBeInTheDocument();
});

it('loads older alerts and shows fetch errors rather than a false empty state', async () => {
    const list = vi.spyOn(notificationsApi, 'list').mockRejectedValueOnce(new Error('Gagal memuat'))
        .mockResolvedValueOnce({ ...response(), next_before_id: 8 }).mockResolvedValueOnce(response([{ ...item, id: 7, title: 'Older' }], 2));
    render(<LiveHeaderInbox userId={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifikasi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal memuat');
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Muat lebih banyak' }));
    await screen.findByText('Older');
    expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(list.mock.calls[2][0]).toBe(8);
});

it('polls every 15 seconds, skips hidden tabs and stops after unmount', async () => {
    vi.useFakeTimers();
    const list = vi.spyOn(notificationsApi, 'list').mockResolvedValue(response());
    const { unmount } = render(<LiveHeaderInbox userId={1} />);
    await act(async () => {});
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(list).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(list).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(list).toHaveBeenCalledTimes(2);
});

it('ignores an older in-flight poll after marking a notification read', async () => {
    let resolveOld;
    const list = vi.spyOn(notificationsApi, 'list').mockResolvedValueOnce(response())
        .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
        .mockResolvedValue(response([{ ...item, readAt: '2030-05-15T00:01:00Z' }], 0));
    vi.spyOn(notificationsApi, 'read').mockResolvedValue(null);
    render(<LiveHeaderInbox userId={1} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifikasi, 1 belum dibaca' }));
    fireEvent.focus(window);
    expect(list).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    await screen.findByRole('button', { name: 'Notifikasi' });
    await act(async () => { resolveOld(response()); });
    expect(screen.queryByRole('button', { name: 'Tandai dibaca' })).toBeNull();
});

it('uses authenticated GET and CSRF protected POST API requests', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf">';
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response() });
    vi.stubGlobal('fetch', fetch);
    await notificationsApi.list(9);
    expect(fetch.mock.calls[0][0]).toBe('/notifications?before_id=9');
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
    await notificationsApi.readAll(8);
    expect(fetch.mock.calls[1][1].headers['X-CSRF-TOKEN']).toBe('csrf');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ through_id: 8 });
});
