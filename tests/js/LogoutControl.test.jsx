import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LogoutControl } from '../../resources/js/pages/dashboard/LogoutControl.jsx';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

let tokenMeta;

beforeEach(() => {
    tokenMeta = document.createElement('meta');
    tokenMeta.name = 'csrf-token';
    tokenMeta.content = 'token-123';
    document.head.append(tokenMeta);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    tokenMeta?.remove();
});

function openDialog() {
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    return screen.getByRole('alertdialog', { name: 'You are about to Logout' });
}

it('renders Logout below Settings and disables it without an authenticated user', () => {
    render(<LogoutControl />);
    const trigger = screen.getByRole('button', { name: 'Logout' });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('title', 'Logout tidak tersedia dalam preview');

    fireEvent.click(trigger);
    expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('places Logout directly below Settings in the sidebar and enables it for a real user', () => {
    const { unmount } = render(<DashboardApp />);
    expect(screen.getByRole('button', { name: 'Logout' })).toBeDisabled();
    unmount();

    render(<DashboardApp user={{ name: 'Dewi Lestari', roles: ['staff'] }} />);
    const settings = screen.getByRole('button', { name: /Settings/ });
    const logout = screen.getByRole('button', { name: 'Logout' });

    expect(logout).toBeEnabled();
    expect(settings.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('opens the exact confirmation dialog with Cancel focused and no subtitle', () => {
    render(<LogoutControl enabled />);
    const dialog = openDialog();
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirm = within(dialog).getByRole('button', { name: 'Logout' });
    const form = dialog.querySelector('form');

    expect(within(dialog).getByRole('heading', { name: 'You are about to Logout' })).toBeInTheDocument();
    expect(dialog.querySelectorAll('p')).toHaveLength(0);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(cancel).toHaveFocus();
    expect(confirm).toBeEnabled();
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('action', '/auth/logout');
    expect(form.querySelector('input[name="_token"]')).toHaveValue('token-123');
});

it('closes with Cancel, Escape and backdrop click, and restores focus to the trigger', async () => {
    render(<LogoutControl enabled />);
    const trigger = screen.getByRole('button', { name: 'Logout' });

    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());

    openDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());

    const dialog = openDialog();
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.mouseDown(dialog.parentElement);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
});

it('traps Tab and Shift+Tab inside the dialog', () => {
    render(<LogoutControl enabled />);
    const dialog = openDialog();
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirm = within(dialog).getByRole('button', { name: 'Logout' });

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();
});

it('posts the form with CSRF and redirects after a successful logout', async () => {
    const onLoggedOut = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogoutControl enabled onLoggedOut={onLoggedOut} />);
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': 'token-123',
        },
    }));
    const body = fetchMock.mock.calls[0][1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('_token')).toBe('token-123');
    expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('shows busy state, prevents double submit, and stays open until logout succeeds', async () => {
    const onLoggedOut = vi.fn();
    let resolveRequest;
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    render(<LogoutControl enabled onLoggedOut={onLoggedOut} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Logout' }));

    const pending = within(dialog).getByRole('button', { name: 'Logging out…' });
    expect(pending).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    resolveRequest({ ok: true, status: 200 });
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
});

it('keeps the dialog open and shows a CSRF error when logout fails', async () => {
    const onLoggedOut = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 419 }));

    render(<LogoutControl enabled onLoggedOut={onLoggedOut} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Logout' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sesi halaman sudah kedaluwarsa');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Logout' })).toBeEnabled();
    expect(onLoggedOut).not.toHaveBeenCalled();
});

it('shows a network error and allows retry', async () => {
    const onLoggedOut = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    render(<LogoutControl enabled onLoggedOut={onLoggedOut} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Logout' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tidak dapat terhubung ke server');
    expect(within(dialog).getByRole('button', { name: 'Logout' })).toBeEnabled();
    expect(onLoggedOut).not.toHaveBeenCalled();
});
