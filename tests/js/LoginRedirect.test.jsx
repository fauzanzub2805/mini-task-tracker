import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LoginApp } from '../../resources/js/pages/login/LoginApp.jsx';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('redirects existing sessions to protected dashboard', () => {
    const assign = vi.fn(); vi.stubGlobal('window', { location: { assign } });
    render(<LoginApp user={{ name: 'Budi' }} />);
    expect(assign).toHaveBeenCalledWith('/dashboard');
});
it('does not redirect design previews with an active session', () => {
    const assign = vi.fn(); vi.stubGlobal('window', { location: { assign } });
    render(<LoginApp user={{ name: 'Budi' }} previewState="success" />);
    expect(assign).not.toHaveBeenCalled();
});
it('redirects after successful credentials', async () => {
    const assign = vi.fn(); vi.stubGlobal('window', { location: { assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { name: 'Budi' } }) }));
    render(<LoginApp />);
    fireEvent.change(screen.getByLabelText('Company/Referral Email'), { target: { value: 'b@x.id' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    await act(async () => fireEvent.submit(screen.getByTestId('login-submit').closest('form')));
    expect(assign).toHaveBeenCalledWith('/dashboard');
});
