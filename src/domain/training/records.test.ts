import { describe, expect, it } from 'vitest';

import {
  createFreeSessionRecordId,
  formatPace,
  isRpe,
  plannedSessionRecordId,
  runPaceSecondsPerKm,
  validatePositiveNumber,
} from './records';

describe('training records', () => {
  it('accepts only integer RPE values from 1 to 10', () => {
    expect(isRpe(1)).toBe(true);
    expect(isRpe(10)).toBe(true);
    expect(isRpe(0)).toBe(false);
    expect(isRpe(5.5)).toBe(false);
  });

  it('builds stable IDs for planned sessions and unique IDs for free sessions', () => {
    expect(plannedSessionRecordId('2026-10-12', 'mon', 0)).toBe('planned_2026-10-12_mon_1');
    expect(createFreeSessionRecordId(100, 0.5)).toBe('free_100_i');
  });

  it('calculates and formats running pace', () => {
    expect(runPaceSecondsPerKm(5000, 1500)).toBe(300);
    expect(formatPace(305)).toBe('5:05 min/km');
    expect(formatPace(0)).toBe('—');
  });

  it('validates positive numbers and accepts decimal commas', () => {
    expect(validatePositiveNumber('12,5', 'Distancia')).toBe(12.5);
    expect(() => validatePositiveNumber('0', 'Distancia')).toThrow('Distancia debe ser mayor que 0.');
  });
});
