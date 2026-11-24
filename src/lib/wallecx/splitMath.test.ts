import { describe, it, expect } from 'vitest';
import {
  equalSplit,
  weightedSplit,
  percentagesFromShares,
  shareCountsFromShares,
} from './splitMath';

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

describe('weightedSplit', () => {
  it('splits by percentage and sums exactly to the total', () => {
    // 50% / 30% / 20% of 100.00
    const r = weightedSplit(10000, { a: 50, b: 30, c: 20 });
    expect(r).toEqual({ a: 5000, b: 3000, c: 2000 });
    expect(sum(r)).toBe(10000);
  });

  it('distributes leftover cents by largest fractional remainder', () => {
    // 100.01 split by thirds: 33.337 each → 3334/3334/3333 (two largest fracs win)
    const r = weightedSplit(10001, { a: 1, b: 1, c: 1 });
    expect(sum(r)).toBe(10001);
    const vals = Object.values(r).sort((x, y) => y - x);
    expect(vals).toEqual([3334, 3334, 3333]);
  });

  it('splits by share counts (2:1)', () => {
    const r = weightedSplit(9000, { a: 2, b: 1 });
    expect(r).toEqual({ a: 6000, b: 3000 });
    expect(sum(r)).toBe(9000);
  });

  it('handles uneven share weights summing exactly', () => {
    const r = weightedSplit(10000, { a: 1, b: 1, c: 1 }); // 33.34/33.33/33.33
    expect(sum(r)).toBe(10000);
    const vals = Object.values(r).sort((x, y) => y - x);
    expect(vals).toEqual([3334, 3333, 3333]);
  });

  it('returns all-zero for non-positive total weight', () => {
    expect(weightedSplit(10000, { a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });

  it('returns empty for no participants', () => {
    expect(weightedSplit(10000, {})).toEqual({});
  });

  it('sums to total across many weight/total combos', () => {
    const weightSets: Record<string, number>[] = [
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 70 },
      { a: 1, b: 1 },
      { a: 5, b: 5, c: 5, d: 5 },
    ];
    for (const w of weightSets) {
      for (let total = 0; total <= 200; total++) {
        expect(sum(weightedSplit(total, w))).toBe(total);
      }
    }
  });
});

describe('percentagesFromShares', () => {
  it('recovers an even 50/50 split', () => {
    expect(percentagesFromShares({ a: 7666, b: 7665 })).toEqual({ a: 50, b: 50 });
  });

  it('recovers 50/25/25', () => {
    expect(percentagesFromShares({ a: 5000, b: 2500, c: 2500 })).toEqual({
      a: 50,
      b: 25,
      c: 25,
    });
  });

  it('recovers a third each with the remainder cent to the leftmost', () => {
    expect(percentagesFromShares({ a: 3334, b: 3333, c: 3333 })).toEqual({
      a: 34,
      b: 33,
      c: 33,
    });
  });

  it('always sums to 100 for non-zero stored shares', () => {
    const sets: Record<string, number>[] = [
      { a: 1, b: 1, c: 1 },
      { a: 7666, b: 7665 },
      { a: 1700, b: 3300, c: 5000 },
      { a: 9999 },
    ];
    for (const set of sets) {
      expect(sum(percentagesFromShares(set))).toBe(100);
    }
  });

  it('returns all-zero for an all-zero set', () => {
    expect(percentagesFromShares({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe('shareCountsFromShares', () => {
  it('reduces clean ratios to small integers', () => {
    expect(shareCountsFromShares({ a: 5000, b: 2500, c: 2500 })).toEqual({
      a: 2,
      b: 1,
      c: 1,
    });
    expect(shareCountsFromShares({ a: 2000, b: 3000, c: 5000 })).toEqual({
      a: 2,
      b: 3,
      c: 5,
    });
  });

  it('collapses remainder-cent noise to equal shares', () => {
    expect(shareCountsFromShares({ a: 3334, b: 3333, c: 3333 })).toEqual({
      a: 1,
      b: 1,
      c: 1,
    });
  });

  it('keeps zero-share participants at zero', () => {
    expect(shareCountsFromShares({ a: 5000, b: 5000, c: 0 })).toEqual({
      a: 1,
      b: 1,
      c: 0,
    });
  });

  it('falls back to one each when every share is zero', () => {
    expect(shareCountsFromShares({ a: 0, b: 0 })).toEqual({ a: 1, b: 1 });
  });

  it('returns an empty map for no participants', () => {
    expect(shareCountsFromShares({})).toEqual({});
  });
});
