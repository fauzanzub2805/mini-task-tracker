import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { buildTimeline, dayNumber, GanttCalendar, projectRows, taskRows } from '../../resources/js/pages/calendar/GanttCalendar.jsx';
import { DashboardApp } from '../../resources/js/pages/dashboard/DashboardApp.jsx';

// "Hari ini" dikunci agar posisi bar dan status overdue deterministik.
const TODAY = new Date(2026, 10, 23, 12);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
});

const projects = [
    { id: 1, name: 'Google Vendor', created_at: '2026-11-02T03:00:00.000000Z' },
    { id: 2, name: 'Aplikasi Mobile', created_at: '2026-10-05T03:00:00.000000Z' },
    { id: 3, name: 'Riset Internal', created_at: '2026-11-20T03:00:00.000000Z' },
];

function task(overrides) {
    return {
        id: 11, project_id: 1, title: 'Revisi Fitur', status: 'todo',
        priority: { id: 3, name: 'high' }, due_date: '2026-11-28', created_at: '2026-11-10T03:00:00.000000Z',
        assignee: { id: 2, name: 'Dewi Anggraini' }, assignees: [{ id: 2, name: 'Dewi Anggraini' }],
        ...overrides,
    };
}

const tasksByProject = {
    1: [
        task({ id: 11, title: 'Revisi Fitur', status: 'done', due_date: '2026-11-28' }),
        task({ id: 12, title: 'Perbaikan Alur', status: 'in_progress', due_date: '2026-12-10' }),
        task({ id: 13, title: 'Tanpa Tanggal', status: 'todo', due_date: null, assignee: null, assignees: [] }),
    ],
    2: [
        task({ id: 21, project_id: 2, title: 'Uji Regresi', status: 'testing', due_date: '2026-11-15', created_at: '2026-10-06T03:00:00.000000Z' }),
    ],
    3: [],
};

const paged = rows => ({ data: rows, links: { next: null } });

function respond(payload, status = 200) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => payload });
}

function setup() {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(url => {
        const path = String(url).split('?')[0];
        if (path === '/projects') return respond(paged(projects));
        const match = /^\/projects\/(\d+)\/tasks$/.exec(path);
        if (match) return respond(paged(tasksByProject[match[1]] ?? []));
        if (path === '/projects/1') return respond({ data: projects[0] });
        if (path === '/tasks/12') return respond({ data: tasksByProject[1][1] });
        return respond(paged([]));
    }));
}

it('derives each project deadline and progress from its tasks', () => {
    const rows = projectRows(projects, tasksByProject, TODAY);

    // Deadline terdekat lebih dulu; project tanpa due date di urutan terakhir.
    expect(rows.map(row => row.name)).toEqual(['Aplikasi Mobile', 'Google Vendor', 'Riset Internal']);
    const google = rows[1];
    expect(google.end).toBe(dayNumber(new Date(2026, 11, 10)));
    expect(google.start).toBe(dayNumber(new Date(2026, 10, 2)));
    expect([google.done, google.total]).toEqual([1, 3]);
    expect(google.overdue).toBe(false);
    expect(rows[0].overdue).toBe(true);
    expect(rows[2].end).toBeNull();
});

it('builds task bars from created date to due date and never inverts them', () => {
    const rows = taskRows([
        task({ id: 1, title: 'Normal', due_date: '2026-11-28' }),
        task({ id: 2, title: 'Terlambat dibuat', due_date: '2026-11-01', status: 'done' }),
        task({ id: 3, title: 'Tanpa due date', due_date: null }),
    ], TODAY);

    expect(rows.map(row => row.name)).toEqual(['Terlambat dibuat', 'Normal', 'Tanpa due date']);
    expect(rows[0].start).toBe(rows[0].end);
    expect(rows[0].overdue).toBe(false);
    expect(rows[1].end - rows[1].start).toBe(18);
    expect(rows[2].end).toBeNull();
});

it('picks a readable scale for the visible range and always includes today', () => {
    const short = buildTimeline(taskRows(tasksByProject[1], TODAY), TODAY);
    expect(short.scale).toBe('day');
    expect(short.todayOffset).toBeGreaterThan(0);
    expect(short.todayOffset).toBeLessThan(short.days);

    const long = buildTimeline([{ start: dayNumber(new Date(2025, 0, 1)), end: dayNumber(new Date(2026, 11, 31)) }], TODAY);
    expect(long.scale).toBe('month');
    expect(buildTimeline([], TODAY, 'week').scale).toBe('week');
    expect(long.months[0].label).toBe('December 2024');
});

it('shows one bar per project with its deadline by default', async () => {
    setup();
    render(<GanttCalendar />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar : Project Deadline Timeline' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Daftar project' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByRole('button', { name: /^Project Google Vendor, 2 November 2026 sampai 10 December 2026, 1 dari 3 task selesai$/ })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /^Project Aplikasi Mobile.*melewati deadline$/ })).toBeInTheDocument();
    expect(within(list).getByText('10 Dec 2026 · 33%')).toBeInTheDocument();
    expect(within(list).getByText('Overdue')).toBeInTheDocument();
    expect(within(list).getByText('Belum ada deadline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Project Deadlines' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 project · 1 melewati deadline · 1 belum punya deadline')).toBeInTheDocument();
});

it('opens the task timeline of a project and switches project from the bar', async () => {
    setup();
    window.history.replaceState({}, '', '/calendar');
    render(<GanttCalendar />);

    fireEvent.click(await screen.findByRole('button', { name: /^Project Google Vendor/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Calendar : Task Deadline Timeline' })).toBeInTheDocument();
    expect(window.location.search).toBe('?view=tasks&project=1');
    const list = screen.getByRole('list', { name: 'Daftar task' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByRole('button', { name: 'Task Perbaikan Alur, 10 November 2026 sampai 10 December 2026, In Progress' })).toBeInTheDocument();
    expect(within(list).getByText('In Progress · Dewi Anggraini')).toBeInTheDocument();
    expect(within(list).getByText('Belum ada due date')).toBeInTheDocument();
    // Warna bar mengikuti status task.
    expect(within(list).getByRole('button', { name: /^Task Perbaikan Alur/ }).closest('.gantt-row')).toHaveClass('gantt-tone-progress');

    const bar = screen.getByRole('group', { name: 'Tampilan Gantt chart' });
    fireEvent.click(within(bar).getByRole('button', { name: /Google Vendor/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Google Vendor' })).getByRole('option', { name: 'Aplikasi Mobile' }));

    expect(window.location.search).toBe('?view=tasks&project=2');
    expect(screen.getByRole('button', { name: /^Task Uji Regresi.*Testing, melewati deadline$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Task Perbaikan Alur/ })).toBeNull();

    fireEvent.click(within(bar).getByRole('button', { name: 'Project Deadlines' }));
    expect(window.location.search).toBe('');
    expect(screen.getByRole('list', { name: 'Daftar project' })).toBeInTheDocument();
});

it('restores the task timeline from the URL and lets the scale be changed', async () => {
    setup();
    window.history.replaceState({}, '', '/calendar?view=tasks&project=2');
    render(<GanttCalendar />);

    expect(await screen.findByRole('button', { name: /^Task Uji Regresi/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Scale: Auto/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /^Scale: Auto/ })).getByRole('option', { name: 'Month' }));
    expect(screen.getByRole('button', { name: /^Scale: Month/ })).toBeInTheDocument();
});

it('replaces the Calendar placeholder and opens task detail from a task bar', async () => {
    setup();
    window.history.replaceState({}, '', '/calendar?view=tasks&project=1');
    render(<DashboardApp user={{ id: 2, name: 'Dewi Anggraini', roles: ['staff'] }} page="calendar" />);

    const sidebar = within(document.getElementById('dashboard-sidebar'));
    expect(sidebar.getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(await screen.findByRole('button', { name: /^Task Perbaikan Alur/ }));

    expect(window.location.pathname).toBe('/projects/1/tasks/12');
    expect(window.location.search).toBe('?view=mytask');
});
