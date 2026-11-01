import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectInfoTab, SettingsTab } from '../../resources/js/pages/projects/ProjectDetail.jsx';
import { projectsApi } from '../../resources/js/pages/projects/projectsApi.js';

const project = { id: 1, name: 'Project', description: 'Description', image_url: '/projects/1/image?v=old' };
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let revoke;
beforeEach(() => {
    URL.createObjectURL = vi.fn(file => `blob:${file.name}`);
    revoke = URL.revokeObjectURL = vi.fn();
    vi.spyOn(projectsApi, 'users').mockResolvedValue([{ id: 2, name: 'New member' }]);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
});

function choose(name = 'cover.png', type = 'image/png', size = 100) {
    const file = new File(['image'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    fireEvent.change(screen.getByLabelText('Image'), { target: { files: [file] } });
    return file;
}

it('previews, replaces and saves the image with fields, retaining drafts during polling', async () => {
    const save = vi.spyOn(projectsApi, 'update').mockResolvedValue({ data: { ...project, image_url: '/projects/1/image?v=new' } });
    const refresh = vi.fn();
    const { rerender, unmount } = render(<SettingsTab project={project} canManage onRefresh={refresh} />);
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', project.image_url);
    choose();
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:cover.png');
    const replacement = choose('replacement.png', 'image/png');
    expect(revoke).toHaveBeenCalledWith('blob:cover.png');
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Draft' } });
    rerender(<SettingsTab project={{ ...project, name: 'Polled name' }} canManage onRefresh={refresh} />);
    expect(screen.getByLabelText('Project Name')).toHaveValue('Draft');
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:replacement.png');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Perubahan project disimpan.');
    expect(save).toHaveBeenCalledWith(1, { name: 'Draft', description: 'Description', image: replacement });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', '/projects/1/image?v=new');
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:replacement.png'));
    choose('last.jpg', 'image/jpeg');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:last.jpg');
});

it('can cancel image changes and persist removal without submitting a file', async () => {
    const save = vi.spyOn(projectsApi, 'update').mockResolvedValue({ data: { ...project, image_url: null } });
    render(<SettingsTab project={project} canManage />);
    choose();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Image Change' }));
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', project.image_url);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    expect(screen.queryByAltText('Project image preview')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Image Change' }));
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', project.image_url);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await screen.findByText('Perubahan project disimpan.');
    expect(save).toHaveBeenCalledWith(1, { name: 'Project', description: 'Description', remove_image: true });
    expect(screen.queryByAltText('Project image preview')).toBeNull();
});

it('rejects unsupported and oversized files while accepting exactly 5 MB', async () => {
    render(<SettingsTab project={project} canManage />);
    await screen.findByRole('option', { name: 'New member' });
    choose('bad.svg', 'image/svg+xml');
    expect(screen.getByRole('alert')).toHaveTextContent('maksimal 5 MB');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    choose('large.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    choose('limit.jpg', 'image/jpeg', 5 * 1024 * 1024);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:limit.jpg');
});

it('preserves a failed upload for retry and disables editing during save', async () => {
    let reject;
    vi.spyOn(projectsApi, 'update').mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
    render(<SettingsTab project={project} canManage />);
    choose();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByLabelText('Image')).toBeDisabled();
    expect(screen.getByLabelText('Project Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Image' })).toBeDisabled();
    reject(new Error('Upload failed'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByLabelText('Image')).not.toBeDisabled();
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:cover.png');
});

it('hides editing for staff and uses image_url in Project Info', () => {
    const { rerender } = render(<SettingsTab project={project} canManage={false} />);
    expect(screen.queryByLabelText('Image')).toBeNull();
    expect(projectsApi.users).not.toHaveBeenCalled();
    rerender(<ProjectInfoTab project={project} tasks={[]} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', project.image_url);
});

it('clears an image draft when navigating to another project', async () => {
    const { rerender } = render(<SettingsTab project={project} canManage />);
    await screen.findByRole('option', { name: 'New member' });
    choose();
    rerender(<SettingsTab project={{ id: 2, name: 'Other', image_url: null }} canManage />);
    expect(screen.queryByAltText('Project image preview')).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:cover.png');
});

it('sends multipart POST with PATCH override, CSRF and browser boundary; keeps plain changes JSON', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: project }) });
    vi.stubGlobal('fetch', fetch);
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    await projectsApi.update(1, { name: 'Title', description: '', image: file });
    const [path, options] = fetch.mock.calls[0];
    expect(path).toBe('/projects/1');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers['X-CSRF-TOKEN']).toBe('test-token');
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body.get('_method')).toBe('PATCH');
    expect(options.body.get('image')).toBe(file);
    expect(options.body.get('description')).toBe('');
    await projectsApi.update(1, { remove_image: true });
    expect(fetch.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ remove_image: true });
    document.head.innerHTML = '';
});

it('keeps the select and Add Member button together and adds the selected user', async () => {
    const add = vi.spyOn(projectsApi, 'addMember').mockResolvedValue({});
    render(<SettingsTab project={project} canManage />);
    await screen.findByRole('option', { name: 'New member' });
    const select = screen.getByLabelText('Add existing user');
    const button = screen.getByRole('button', { name: 'Add Member' });
    expect(select.parentElement).toBe(button.parentElement);
    expect(select.parentElement).toHaveClass('projects-member-row');
    fireEvent.change(select, { target: { value: '2' } });
    fireEvent.click(button);
    await waitFor(() => expect(add).toHaveBeenCalledWith(1, { user_id: 2, role: 'staff' }));
});
