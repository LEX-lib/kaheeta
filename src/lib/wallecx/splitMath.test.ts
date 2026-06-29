import { describe, it, expect } from 'vitest';
import { equalSplit } from './splitMath';

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('equalSplit', () => {
  it('splits evenly when divisible', () => {
    const r = equalSplit(30000, ['a', 'b', 'c']);
    expect(r).toEqual({ a: 10000, b: 10000, c: 10000 });
    expect(sum(r)).toBe(30000);
  });

  it('distributes remainder cents to the leftmost participants', () => {
    const r = equalSplit(10000, ['a', 'b', 'c']); // 100.00 / 3 = 33.34, 33.33, 33.33
    expect(r).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(sum(r)).toBe(10000);
  });

  it('handles a single participant', () => {
    const r = equalSplit(4567, ['solo']);
    expect(r).toEqual({ solo: 4567 });
    expect(sum(r)).toBe(4567);
  });

  it('handles a zero amount', () => {
    const r = equalSplit(0, ['a', 'b']);
    expect(r).toEqual({ a: 0, b: 0 });
    expect(sum(r)).toBe(0);
  });

  it('returns an empty map for no participants', () => {
    expect(equalSplit(1000, [])).toEqual({});
  });

  it('always sums to the total across many remainder sizes', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let total = 0; total <= 100; total++) {
      for (let n = 1; n <= ids.length; n++) {
        expect(sum(equalSplit(total, ids.slice(0, n)))).toBe(total);
      }
    }
  });
});
