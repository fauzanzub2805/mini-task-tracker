import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsTab } from '../../resources/js/pages/projects/ProjectDetail.jsx';
import { projectsApi } from '../../resources/js/pages/projects/projectsApi.js';

const project = { id: 1, name: 'Project', permissions: { manageMembers: true } };
const members = [
    { user_id: 1, user: { name: 'Manager' }, role: { name: 'manager' } },
    { user_id: 2, user: { name: 'Staff' }, role: { name: 'staff' } },
];
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
beforeEach(() => {
    vi.spyOn(projectsApi, 'users').mockResolvedValue([]);
    URL.createObjectURL = vi.fn(file => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
    cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
});

it('supports click selection and a natively keyboard-accessible dropzone with screenshot copy', async () => {
    render(<SettingsTab project={project} canManage />);
    const zone = screen.getByRole('button', { name: 'Choose Image' });
    expect(zone.tagName).toBe('BUTTON'); // Native Enter/Space activation, no custom keyboard emulation.
    expect(zone).toHaveAttribute('type', 'button');
    zone.focus();
    expect(zone).toHaveFocus();
    const input = screen.getByLabelText('Image');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(zone);
    expect(click).toHaveBeenCalledOnce();
    expect(input.accept).toBe('image/jpeg,image/png,.jpg,.jpeg,.png');
    expect(screen.getByText('Drop your image here')).toBeInTheDocument();
    expect(screen.getByText('Max 5 MB, only JPEG, JPG, PNG accepted')).toBeInTheDocument();
    await waitFor(() => expect(projectsApi.users).toHaveBeenCalled());
});

it('validates drag/drop type, size and file count and previews a valid dropped JPEG', async () => {
    render(<SettingsTab project={project} canManage />);
    const zone = screen.getByRole('button', { name: 'Choose Image' });
    fireEvent.dragOver(zone);
    expect(zone).toHaveClass('is-dragging');
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass('is-dragging');
    const webp = new File(['x'], 'bad.webp', { type: 'image/webp' });
    fireEvent.drop(zone, { dataTransfer: { files: [webp] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG, JPG, atau PNG');
    const large = new File(['x'], 'large.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.drop(zone, { dataTransfer: { files: [large] } });
    expect(screen.getByRole('alert')).toHaveTextContent('maksimal 5 MB');
    fireEvent.drop(zone, { dataTransfer: { files: [webp, large] } });
    expect(screen.getByRole('alert')).toHaveTextContent('satu gambar');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    const jpeg = new File(['x'], 'valid.jpg', { type: 'image/jpeg' });
    fireEvent.drop(zone, { dataTransfer: { files: [jpeg] } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:valid.jpg');
    expect(screen.getByRole('button', { name: 'Replace Image' })).toBeInTheDocument();
    await waitFor(() => expect(projectsApi.users).toHaveBeenCalled());
});

it('ignores drops during an in-flight save', async () => {
    let resolve;
    vi.spyOn(projectsApi, 'update').mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<SettingsTab project={project} canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    const zone = screen.getByRole('button', { name: 'Choose Image' });
    expect(zone).toBeDisabled();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'busy.png', { type: 'image/png' })] } });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    resolve({ data: project });
    await screen.findByText('Perubahan project disimpan.');
});

it('confirms membership-only removal, supports cancellation, disables controls and refreshes', async () => {
    let resolve;
    const remove = vi.spyOn(projectsApi, 'removeMember').mockImplementation(() => new Promise(done => { resolve = done; }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const refresh = vi.fn();
    render(<SettingsTab project={project} members={members} canManage onRefresh={refresh} />);
    const button = screen.getByRole('button', { name: 'Remove Staff from project' });
    expect(screen.getByRole('button', { name: 'Remove Manager from project' })).toBeDisabled();
    fireEvent.click(button);
    expect(remove).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('not their user account'));
    confirm.mockReturnValue(true);
    fireEvent.click(button);
    expect(remove).toHaveBeenCalledWith(1, 2);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Removing');
    expect(screen.getByLabelText('Add existing user')).toBeDisabled();
    resolve(null);
    await screen.findByText('Staff removed from project.');
    expect(refresh).toHaveBeenCalledOnce();
});

it('shows removal failure without removing the member and honors manageMembers permission', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const remove = vi.spyOn(projectsApi, 'removeMember').mockRejectedValue(new Error('Removal forbidden'));
    const { rerender } = render(<SettingsTab project={project} members={members} canManage />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Staff from project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Removal forbidden');
    expect(screen.getByRole('button', { name: 'Remove Staff from project' })).not.toBeDisabled();
    rerender(<SettingsTab project={{ ...project, permissions: { manageMembers: false } }} members={members} canManage />);
    expect(screen.queryByRole('button', { name: 'Remove Staff from project' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Member' })).toBeNull();
    expect(remove).toHaveBeenCalledOnce();
});

it('allows removing a manager when another remains', async () => {
    render(<SettingsTab project={project} members={[...members, { user_id: 3, user: { name: 'Other' }, role: { name: 'manager' } }]} canManage />);
    expect(screen.getByRole('button', { name: 'Remove Manager from project' })).not.toBeDisabled();
    await waitFor(() => expect(projectsApi.users).toHaveBeenCalled());
});

it('uses the membership DELETE endpoint rather than deleting a user account', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetch);
    await projectsApi.removeMember(1, 2);
    expect(fetch).toHaveBeenCalledWith('/projects/1/members/2', expect.objectContaining({ method: 'DELETE', credentials: 'same-origin' }));
});
