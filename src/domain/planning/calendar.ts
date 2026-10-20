// Utilidades de calendario puras para las vistas de semana y mes de Plan.
//
// Todo el proyecto usa fechas ISO "YYYY-MM-DD" en UTC y semanas de lunes
// a domingo (ALL_WEEK_DAYS). Este módulo solo añade lo que falta para
// paginar semanas y construir la rejilla del mes; no conoce React ni
// Firebase.

import { ALL_WEEK_DAYS } from '@/domain/profile';

export const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Escala (o retrocede) una fecha ISO el número de días indicado, en UTC. */
export function addUtcDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${dateIso}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Extrae año y mes (1-12) de una fecha ISO. */
export function monthOf(dateIso: string): { year: number; month: number } {
  const [year, month] = dateIso.slice(0, 10).split('-').map(Number);
  return { year, month };
}

/** Etiqueta legible del mes en español: "octubre 2026". */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

/** Fecha ISO de un día dentro de un mes (sin tocar el mes anterior/siguiente). */
export function dateAt(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface MonthCell {
  /** Fecha ISO (YYYY-MM-DD). */
  date: string;
  /** Número de día del mes real (1-31). */
  dayOfMonth: number;
  /** false para los días de relleno de semanas de otro mes. */
  inMonth: boolean;
  /** Día de la semana del plan correspondiente a esa fecha. */
  weekDay: (typeof ALL_WEEK_DAYS)[number];
}

/**
 * Rejilla del mes en semanas de lunes a domingo (formato calendario
 * Europeo). Los huecos al principio y al final se rellenan con días de
 * los meses contiguos para que cada fila tenga 7 celdas.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  if (month < 1 || month > 12) {
    throw new Error(`Mes inválido: ${month}`);
  }

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingEmpty = (firstDay.getUTCDay() + 6) % 7; // lunes = 0
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: MonthCell[] = [];

  // Días de relleno del mes anterior (contando hacia atrás desde el 1).
  for (let offset = leadingEmpty; offset > 0; offset--) {
    const date = addUtcDays(dateAt(year, month, 1), -offset);
    cells.push({
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      inMonth: false,
      weekDay: ALL_WEEK_DAYS[(leadingEmpty - offset)],
    });
  }

  for (let day = 1; day <= lastDay; day++) {
    const weekDay = ALL_WEEK_DAYS[(leadingEmpty + day - 1) % 7];
    cells.push({ date: dateAt(year, month, day), dayOfMonth: day, inMonth: true, weekDay });
  }

  while (cells.length % 7 !== 0) {
    const lastDate = cells[cells.length - 1].date;
    const nextDate = addUtcDays(lastDate, 1);
    const weekDay = ALL_WEEK_DAYS[(cells.length) % 7];
    cells.push({
      date: nextDate,
      dayOfMonth: Number(nextDate.slice(8, 10)),
      inMonth: false,
      weekDay,
    });
  }

  const rows: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}
