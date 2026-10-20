import { describe, expect, it } from 'vitest';

import { addUtcDays, buildMonthGrid, monthLabel, monthOf } from './calendar';

describe('addUtcDays', () => {
  it('suma y resta días en UTC sin desfases', () => {
    expect(addUtcDays('2026-10-12', 7)).toBe('2026-10-19');
    expect(addUtcDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addUtcDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('monthOf', () => {
  it('extrae año y mes (1-12)', () => {
    expect(monthOf('2026-10-18')).toEqual({ year: 2026, month: 10 });
    expect(monthOf('2027-01-05')).toEqual({ year: 2027, month: 1 });
  });
});

describe('monthLabel', () => {
  it('devuelve el nombre del mes en español con el año', () => {
    expect(monthLabel(2026, 10)).toBe('octubre 2026');
    expect(monthLabel(2027, 1)).toBe('enero 2027');
  });
});

describe('buildMonthGrid', () => {
  it('genera semanas de lunes a domingo', () => {
    const grid = buildMonthGrid(2026, 10);
    // oct-2026 empieza en jueves, así que la primera fila tiene relleno de
    // septiembre: 2026-09-28 (lunes).
    expect(grid[0][0]).toMatchObject({ date: '2026-09-28', inMonth: false });
    expect(grid[0][3]).toMatchObject({ date: '2026-10-01', inMonth: true });
    expect(grid).toHaveLength(5);
    grid.forEach((week) => {
      expect(week).toHaveLength(7);
    });
    const lastRow = grid[grid.length - 1];
    expect(lastRow[6]).toMatchObject({ date: '2026-11-01', inMonth: false });
    expect(lastRow[0]).toMatchObject({ date: '2026-10-26', inMonth: true });
  });

  it('cubre los 31 días de octubre entre relleno de meses contiguos', () => {
    const grid = buildMonthGrid(2026, 10);
    const cells = grid.flat();
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it('febrero bisiesto', () => {
    const grid = buildMonthGrid(2028, 2);
    expect(grid.flat().filter((c) => c.inMonth)).toHaveLength(29);
  });
});
