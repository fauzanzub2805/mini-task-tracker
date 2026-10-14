import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginApp } from '../../resources/js/pages/login/LoginApp.jsx';
import { useLogin } from '../../resources/js/pages/login/useLogin.js';

const response = (status, body = {}, retry = null) => ({ ok: status < 300, status, json: async () => body, headers: { get: () => retry } });
const user = { id: 1, name: 'Budi', email: 'b@x.id', roles: ['staff'] };
function fill() {
    fireEvent.change(screen.getByLabelText('Company/Referral Email'), { target: { value: ' b@x.id ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rahasia' } });
}
function submit() { fireEvent.submit(screen.getByTestId('login-submit').closest('form')); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); document.cookie = 'XSRF-TOKEN=; max-age=0'; });

describe('React login', () => {
    it('renders accessible inputs and toggles password visibility', () => {
        render(<LoginApp />);
        expect(screen.getByLabelText('Company/Referral Email')).toHaveAttribute('autocomplete', 'username');
        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        fireEvent.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }));
        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
        expect(document.querySelector('[name="remember"]')).toBeNull();
        expect(document.querySelector('a[href="/register"]')).toBeNull();
    });
    it('validates without sending requests and clears field errors on edit', () => {
        const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
        render(<LoginApp />); submit();
        expect(fetch).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Company/Referral Email')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Company/Referral Email')).toHaveFocus();
        fill();
        expect(screen.getByLabelText('Company/Referral Email')).toHaveAttribute('aria-invalid', 'false');
    });
    it('posts same-origin JSON with CSRF, renders success without storage', async () => {
        const storage = vi.spyOn(Storage.prototype, 'setItem');
        const fetch = vi.fn().mockResolvedValue(response(200, { data: user })); vi.stubGlobal('fetch', fetch);
        render(<LoginApp csrfToken="meta-token" />); fill(); submit();
        expect(await screen.findByText('Login berhasil')).toBeInTheDocument();
        expect(screen.getByText('Budi')).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
            method: 'POST', credentials: 'same-origin', body: JSON.stringify({ email: 'b@x.id', password: 'rahasia' }),
            headers: expect.objectContaining({ 'X-CSRF-TOKEN': 'meta-token', Accept: 'application/json' }),
        }));
        expect(storage).not.toHaveBeenCalled();
    });
    it('blocks repeated submits during loading', async () => {
        let resolve;
        const fetch = vi.fn(() => new Promise(r => { resolve = r; })); vi.stubGlobal('fetch', fetch);
        render(<LoginApp />); fill();
        const form = screen.getByTestId('login-submit').closest('form');
        act(() => { fireEvent.submit(form); fireEvent.submit(form); });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Memproses…');
        expect(screen.queryByTestId('login-submit')).toBeNull();
        await act(async () => resolve(response(200, { data: user })));
    });
    it('maps 422 to fields and clears password', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(422, { errors: { email: ['These credentials do not match our records.'] } })));
        render(<LoginApp />); fill(); submit();
        await waitFor(() => expect(screen.getByLabelText('Company/Referral Email')).toHaveAttribute('aria-invalid', 'true'));
        expect(screen.getByLabelText('Password')).toHaveValue('');
        expect(screen.getByRole('alert')).toHaveTextContent('tidak cocok');
    });
    it('offers reload after 419', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(419)));
        render(<LoginApp />); fill(); submit();
        expect(await screen.findByRole('button', { name: 'Muat ulang halaman' })).toBeInTheDocument();
    });
    it('locks on 429 and unlocks when countdown ends; cleans timer on unmount', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, {}, '2')));
        const view = render(<LoginApp />); fill();
        await act(async () => submit());
        expect(screen.getByTestId('login-submit')).toHaveTextContent('Tunggu 2 detik');
        expect(screen.getByTestId('login-submit')).toBeDisabled();
        await act(async () => vi.advanceTimersByTime(2000));
        expect(screen.getByTestId('login-submit')).toBeEnabled();
        expect(screen.queryByRole('alert')).toBeNull();
        await act(async () => submit());
        view.unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each([500, 'network'])('handles %s failure and allows retry', async status => {
        const fetch = status === 'network' ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue(response(status));
        vi.stubGlobal('fetch', fetch);
        render(<LoginApp />); fill(); submit();
        expect(await screen.findByRole('alert')).toHaveTextContent(status === 'network' ? 'koneksi' : 'server');
        expect(screen.getByTestId('login-submit')).toBeEnabled();
    });
    it('renders existing session and escapes user content', () => {
        render(<LoginApp user={{ ...user, name: '<script>alert(1)</script>' }} />);
        expect(screen.getByText('Login berhasil')).toBeInTheDocument();
        expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
        expect(document.querySelector('script')).toBeNull();
        expect(screen.queryByLabelText('Password')).toBeNull();
    });
    it('logout uses rotated cookie and reloads to get actual session state', async () => {
        const reload = vi.fn(); vi.stubGlobal('window', { location: { reload } });
        const fetch = vi.fn().mockResolvedValue(response(200)); vi.stubGlobal('fetch', fetch);
        const { result } = renderHook(() => useLogin({ user, csrfToken: 'old-token' }));
        document.cookie = 'XSRF-TOKEN=new-token';
        await act(async () => result.current.logout());
        expect(fetch).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'new-token' }) }));
        expect(reload).toHaveBeenCalledOnce();
    });
});
