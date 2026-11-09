import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { MyTaskDetail } from '../../resources/js/pages/projects/MyTaskDetail.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function makeFile(name, size, type = 'application/pdf') {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
}

function task(attachments) {
    return {
        id: 21, project_id: 2, title: 'Final Recap Reimburse',
        description: 'Menyusun rekapan reimburse proyek', status: 'in_progress',
        priority: { id: 3, name: 'high' }, due_date: '2026-09-18',
        project: { id: 2, name: 'Ai for PT.Bukaka' }, attachments,
        can: { update: true, delete: false },
    };
}

function stub(attachments) {
    const state = { posted: null };
    const fetchMock = vi.fn((url, options = {}) => {
        const method = (options.method ?? 'GET').toUpperCase();
        if (String(url) === '/tasks/21' && method === 'GET') {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: task(attachments) }) });
        }
        if (String(url) === '/tasks/21/attachments' && method === 'POST') {
            const form = options.body;
            state.posted = { kind: form.get('kind'), files: form.getAll('files[]').map(file => file.name) };
            return Promise.resolve({ ok: true, status: 201, json: async () => ({ data: [] }) });
        }
        return Promise.reject(new Error(`Unexpected ${method} ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    return state;
}

it('renders the task, its project and the Given Files from instruction attachments', async () => {
    stub([
        { id: 5, kind: 'instruction', name: 'panduan.pdf', size: 1024, mime_type: 'application/pdf', url: '/tasks/21/attachments/5', preview_url: '/tasks/21/attachments/5/preview', uploaded_by: { id: 1, name: 'Manager' } },
    ]);
    render(<MyTaskDetail taskId={21} project={{ id: 2, name: 'Ai for PT.Bukaka' }} navigate={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Final Recap Reimburse' })).toBeInTheDocument();
    expect(screen.getByText('Ai for PT.Bukaka')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Given Files' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'panduan.pdf' })).toHaveAttribute('href', '/tasks/21/attachments/5');
    expect(screen.getByRole('heading', { name: 'Submit File' })).toBeInTheDocument();
});

it('shows "No file attached" when the task has no instruction files', async () => {
    stub([]);
    render(<MyTaskDetail taskId={21} project={{ id: 2, name: 'Ai for PT.Bukaka' }} navigate={vi.fn()} />);
    expect(await screen.findByText('No file attached')).toBeInTheDocument();
});

it('submits chosen files as a submission (kind=submission)', async () => {
    const state = stub([]);
    render(<MyTaskDetail taskId={21} project={{ id: 2, name: 'Ai for PT.Bukaka' }} navigate={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Submit File' });

    const input = screen.getByLabelText('Choose file');
    fireEvent.change(input, { target: { files: [makeFile('laporan.pdf', 4096)] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Submitted Files' }));

    await waitFor(() => expect(state.posted).not.toBeNull());
    expect(state.posted.kind).toBe('submission');
    expect(state.posted.files).toEqual(['laporan.pdf']);
});
