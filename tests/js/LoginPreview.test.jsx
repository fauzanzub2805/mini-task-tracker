import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { LoginApp, PREVIEW_STATES } from '../../resources/js/pages/login/LoginApp.jsx';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(Object.keys(PREVIEW_STATES))('preview %s is labeled and never makes authentication requests', state => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<LoginApp previewState={state} user={{ name: 'Actual user' }} />);
    expect(screen.getByText(/PREVIEW UI/)).toBeInTheDocument();
    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);
    for (const button of screen.getAllByRole('button')) fireEvent.click(button);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Actual user')).toBeNull();
});
it('OTP preview is disabled and shows the correct warning', () => {
    render(<LoginApp previewState="wrong-token" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong OTP Code!');
    expect(screen.getByLabelText('OTP digit 1 (preview)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Re-send OTP Code' })).toBeDisabled();
});
it('real login does not expose preview controls or enable Google', () => {
    render(<LoginApp />);
    expect(screen.queryByText(/PREVIEW UI/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
});
