import { useEffect, useMemo, useState } from 'react';
import { formatDay, parseISODate, toISODate } from './projectsApi.js';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = value => String(value).padStart(2, '0');

function buildCells(year, month) {
    const first = new Date(year, month, 1);
    const offset = first.getDay();
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        return { date, outside: date.getMonth() !== month };
    });
}

/**
 * Kalender bulanan inline untuk Due Date (referensi desain task detail).
 * Klik tanggal langsung mengubah nilai; navigasi bulan memakai tombol panah.
 */
export function CalendarPicker({ value = '', onChange, id = 'projects-calendar' }) {
    const selected = parseISODate(value);
    const [cursor, setCursor] = useState(() => selected ?? new Date());

    useEffect(() => {
        const next = parseISODate(value);
        if (next) setCursor(next);
    }, [value]);

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const cells = useMemo(() => buildCells(year, month), [year, month]);
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
    const selectedKey = selected ? toISODate(selected) : '';
    const todayKey = toISODate(new Date());

    function move(delta) {
        setCursor(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    }

    return <div className="projects-calendar" id={id}>
        <div className="projects-calendar-head">
            <button type="button" className="projects-calendar-nav" aria-label="Bulan sebelumnya" onClick={() => move(-1)}>‹</button>
            <span className="projects-calendar-month" aria-live="polite">{monthLabel}</span>
            <button type="button" className="projects-calendar-nav" aria-label="Bulan berikutnya" onClick={() => move(1)}>›</button>
            {value && <button type="button" className="projects-calendar-clear" aria-label="Hapus tanggal" onClick={() => onChange('')}>×</button>}
        </div>
        <div className="projects-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
        <div className="projects-calendar-grid" role="grid" aria-label="Kalender due date">
            {cells.map(({ date, outside }) => {
                const key = toISODate(date);
                const isSelected = key === selectedKey;
                const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
                return <button
                    type="button"
                    key={key}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={label}
                    className={`projects-calendar-day${outside ? ' is-outside' : ''}${isSelected ? ' is-selected' : ''}${key === todayKey ? ' is-today' : ''}`}
                    onClick={() => onChange(key)}
                >{date.getDate()}</button>;
            })}
        </div>
        <p className="projects-calendar-value">{value ? `Due date: ${formatDay(value)}` : 'Belum ada due date'}</p>
    </div>;
}

export { pad };
