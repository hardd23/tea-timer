import { describe, expect, it } from 'vitest';
import { compareVersions } from './version';

describe('compareVersions', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['2.0.0', '1.9.9', 1],
    ['1.1.0', '1.2.0', -1],
    ['1.2.4', '1.2.3', 1],
    ['1.10.0', '1.9.0', 1],
    ['v1.2.3', '1.2.3', 0],
    ['1.2.3-beta.1', '1.2.3', 0],
    ['1.2.3+build.1', '1.2.3', 0],
  ])('compares %s and %s as %i', (left, right, expected) => {
    expect(compareVersions(left, right)).toBe(expected);
  });

  it.each(['1.2', 'invalid', 'v1.2.x'])('rejects invalid version %s', (version) => {
    expect(() => compareVersions(version, '1.2.3')).toThrow('Invalid application version');
    expect(() => compareVersions('1.2.3', version)).toThrow('Invalid application version');
  });
});
