import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { CalendarPicker } from '../../resources/js/pages/projects/CalendarPicker.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('sets today and returns the calendar to the current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 15, 12));
    const onChange = vi.fn();
    render(<CalendarPicker value="2024-02-29" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenCalledWith('2027-06-15');
    expect(screen.getByRole('combobox', { name: 'Pilih tahun' })).toHaveValue('2027');
    expect(screen.getByRole('combobox', { name: 'Pilih bulan' })).toHaveValue('5');
    expect(screen.getByRole('gridcell', { name: '15 June 2027' })).toBeInTheDocument();
});

it('navigates directly by month and year without changing the due date until a day is chosen', () => {
    const onChange = vi.fn();
    render(<CalendarPicker value="2026-01-31" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Pilih tahun' }), { target: { value: '2028' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Pilih bulan' }), { target: { value: '1' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('gridcell', { name: '29 February 2028' }));
    expect(onChange).toHaveBeenCalledWith('2028-02-29');
});

it('keeps dropdowns synchronized with arrow navigation and external values', () => {
    const onChange = vi.fn();
    const view = render(<CalendarPicker value="2026-12-31" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(screen.getByRole('combobox', { name: 'Pilih tahun' })).toHaveValue('2027');
    expect(screen.getByRole('combobox', { name: 'Pilih bulan' })).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    expect(screen.getByRole('combobox', { name: 'Pilih tahun' })).toHaveValue('2026');
    view.rerender(<CalendarPicker value="2024-02-29" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Pilih tahun' })).toHaveValue('2024');
    expect(screen.getByRole('gridcell', { name: '29 February 2024' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hapus tanggal' }));
    expect(onChange).toHaveBeenCalledWith('');
});
