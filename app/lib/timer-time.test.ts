import { describe, expect, it } from 'vitest';
import {
  getBrewingProgress,
  getBrewingRemainingSeconds,
  getCoolingElapsedSeconds,
  getCoolingProgress,
} from './timer-time';

describe('brewing remaining seconds', () => {
  it.each([
    [10_000, 10],
    [1001, 2],
    [1000, 1],
    [1, 1],
    [0, 0],
    [-1000, 0],
  ])('converts %i ms to %i seconds', (remainingMs, expected) => {
    expect(getBrewingRemainingSeconds(remainingMs)).toBe(expected);
  });
});

describe('cooling elapsed seconds', () => {
  it.each([
    [0, 0],
    [999, 0],
    [1000, 1],
    [180_000, 180],
    [181_000, 181],
    [600_000, 600],
    [-1, 0],
  ])('converts %i ms to %i seconds', (elapsedMs, expected) => {
    expect(getCoolingElapsedSeconds(elapsedMs)).toBe(expected);
  });
});

describe('brewing progress', () => {
  it.each([
    [10_000, 1],
    [5000, 0.5],
    [0, 0],
    [-1000, 0],
    [20_000, 1],
  ])('converts %i ms remaining to progress %s', (remainingMs, expected) => {
    expect(getBrewingProgress(remainingMs, 10_000)).toBe(expected);
  });
});

describe('cooling progress', () => {
  it.each([
    [0, 0],
    [90_000, 0.5],
    [180_000, 1],
    [600_000, 1],
    [-1000, 0],
  ])('converts %i ms elapsed to progress %s', (elapsedMs, expected) => {
    expect(getCoolingProgress(elapsedMs, 180_000)).toBe(expected);
  });
});
