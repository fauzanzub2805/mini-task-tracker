import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskDetail } from '../../resources/js/pages/projects/TaskDetail.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const members = [
    { user_id: 1, user: { id: 1, name: 'Fulan bin Fulan' }, role: { id: 1, name: 'manager' } },
    { user_id: 2, user: { id: 2, name: 'Dewi Anggraini' }, role: { id: 2, name: 'staff' } },
];
const priorities = [{ id: 3, name: 'high', level: 3 }];

function taskPayload(can) {
    return {
        id: 11, project_id: 1, title: 'Fiksasi Tim Google', description: 'desc',
        status: 'in_progress', priority_id: 3, priority: { id: 3, name: 'high' }, due_date: '2026-09-18',
        assignee_id: 2, assignee: { id: 2, name: 'Dewi Anggraini' }, assignees: [{ id: 2, name: 'Dewi Anggraini' }],
        creator: { id: 1, name: 'Fulan bin Fulan' }, created_by_id: 1,
        attachments: [
            { id: 1, kind: 'instruction', name: 'brief.pdf', size: 1024, mime_type: 'application/pdf', url: '/tasks/11/attachments/1', preview_url: '/tasks/11/attachments/1/preview', uploaded_by: { id: 1, name: 'Fulan bin Fulan' } },
            { id: 2, kind: 'submission', name: 'hasil.png', size: 2048, mime_type: 'image/png', url: '/tasks/11/attachments/2', preview_url: '/tasks/11/attachments/2/preview', uploaded_by: { id: 2, name: 'Dewi Anggraini' } },
        ],
        can,
    };
}

function stubTask(can) {
    vi.stubGlobal('fetch', vi.fn((url) => String(url) === '/tasks/11'
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ data: taskPayload(can) }) })
        : Promise.reject(new Error(`Unexpected ${url}`))));
}

function renderDetail() {
    return render(<TaskDetail
        taskId={11}
        project={{ id: 1, name: 'Google Vendor' }}
        members={members}
        activities={[]}
        priorities={priorities}
        user={{ id: 1, roles: ['manager'] }}
        canManage
        navigate={vi.fn()}
        onRefresh={vi.fn()}
        dirtyRef={{ current: false }}
    />);
}

it('splits Instructions File from Submitted Files and shows the submitter name', async () => {
    stubTask({ update: true, delete: true });
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Instructions File' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submitted Files' })).toBeInTheDocument();

    // Berkas instruksi muncul di daftar Instructions File.
    expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
    // Berkas kumpulan muncul di Submitted Files beserta nama pengirimnya.
    expect(screen.getByText('hasil.png')).toBeInTheDocument();
    expect(screen.getByText('Dewi Anggraini', { selector: '.projects-submitted-sender' })).toBeInTheDocument();
});

it('shows the delete control on submitted files when the user may delete (Admin / Project Manager)', async () => {
    stubTask({ update: true, delete: true });
    renderDetail();
    expect(await screen.findByRole('button', { name: 'Hapus hasil.png' })).toBeInTheDocument();
});

it('hides the delete control on submitted files when the user may not delete (Staff)', async () => {
    stubTask({ update: true, delete: false });
    renderDetail();
    // Tunggu task termuat lewat kehadiran nama berkasnya.
    expect(await screen.findByText('hasil.png')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus hasil.png' })).toBeNull();
});
