import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../../resources/js/pages/projects/ProjectsPage.jsx';
import { projectsApi } from '../../resources/js/pages/projects/projectsApi.js';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
beforeEach(() => {
    URL.createObjectURL = vi.fn(file => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
    vi.spyOn(projectsApi, 'priorities').mockResolvedValue({ data: [] });
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    document.head.innerHTML = '';
});

async function openForm() {
    render(<ProjectsPage user={{ id: 1, roles: ['manager'] }} initialPath="/projects" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create New Project' }));
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'New Project' } });
}
function file(name = 'cover.png', type = 'image/png', size = 100) {
    const image = new File(['image'], name, { type });
    Object.defineProperty(image, 'size', { value: size });
    return image;
}
function choose(image) {
    fireEvent.change(screen.getByLabelText('Image'), { target: { files: [image] } });
}

it('adds the screenshot image field, previews a drop, and submits it with the project', async () => {
    const create = vi.spyOn(projectsApi, 'create').mockImplementation(() => new Promise(() => {}));
    await openForm();
    expect(screen.getByText('Drop your image here')).toBeInTheDocument();
    expect(screen.getByText('Max 5 MB, only JPEG, JPG, PNG accepted')).toBeInTheDocument();
    expect(screen.getByLabelText('Image')).toHaveAttribute('accept', 'image/jpeg,image/png,.jpg,.jpeg,.png');
    const click = vi.spyOn(screen.getByLabelText('Image'), 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Image' }));
    expect(click).toHaveBeenCalledOnce();
    const image = file('cover.jpeg', 'image/jpeg', 5 * 1024 * 1024);
    fireEvent.drop(screen.getByRole('button', { name: 'Choose Image' }), { dataTransfer: { files: [image] } });
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:cover.jpeg');
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(create).toHaveBeenCalledWith({ name: 'New Project', description: '', image });
    expect(screen.getByLabelText('Image')).toBeDisabled();
    expect(screen.getByLabelText('Project Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeDisabled();
});

it('rejects invalid types, files over 5 MB, and multiple files without creating previews', async () => {
    await openForm();
    for (const image of [file('large.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), file('x.gif', 'image/gif'), file('x.webp', 'image/webp'), file('x.svg', 'image/svg+xml'), file('x.txt', 'text/plain')]) {
        choose(image);
        expect(screen.getByRole('alert')).toHaveTextContent('JPEG, JPG, atau PNG maksimal 5 MB');
    }
    fireEvent.drop(screen.getByRole('button', { name: 'Choose Image' }), { dataTransfer: { files: [file(), file()] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih satu gambar saja.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    choose(file());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('can replace and remove the selection, create without an image, and release previews', async () => {
    const create = vi.spyOn(projectsApi, 'create').mockResolvedValue({ data: {} });
    await openForm();
    choose(file());
    choose(file('replacement.jpg', 'image/jpeg'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover.png');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:replacement.jpg');
    expect(screen.queryByAltText('Project image preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'New Project', description: '' }));
    await waitFor(() => expect(screen.queryByLabelText('Image')).not.toBeInTheDocument());
});

it('retains the image on server failure for retry and clears it on closing the form', async () => {
    vi.spyOn(projectsApi, 'create').mockRejectedValue(new Error('Upload failed'));
    await openForm();
    choose(file());
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByAltText('Project image preview')).toHaveAttribute('src', 'blob:cover.png');
    expect(screen.getByLabelText('Image')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover.png');
    fireEvent.click(screen.getByRole('button', { name: 'Create New Project' }));
    expect(screen.queryByAltText('Project image preview')).not.toBeInTheDocument();
});

it('posts multipart with CSRF and no manual content type, retaining JSON without an image', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: { id: 1 } }) });
    vi.stubGlobal('fetch', fetch);
    const image = file();
    await projectsApi.create({ name: 'Project', description: '', image });
    const [path, options] = fetch.mock.calls[0];
    expect(path).toBe('/projects');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers['X-CSRF-TOKEN']).toBe('test-token');
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body.get('image')).toBe(image);
    expect(options.body.get('name')).toBe('Project');
    expect(options.body.get('description')).toBe('');
    expect(options.body.has('_method')).toBe(false);
    await projectsApi.create({ name: 'Without image', description: '' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ name: 'Without image', description: '' });
});
