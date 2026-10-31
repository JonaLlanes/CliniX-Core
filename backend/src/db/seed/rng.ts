/** Seeded helpers. Clinical choices stay on this RNG; Faker is seeded separately for names. */

export type Rng = {
  rand: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
};

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    rand,
    int(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(rand() * items.length)]!;
    },
    chance(probability) {
      return rand() < probability;
    },
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.rand() * (i + 1));
    const swap = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = swap;
  }
  return copy;
}

/**
 * Spread `total` across `count` buckets. Each bucket stays within [min, max].
 * Higher weight receives a larger share. The result sums to `total`.
 */
export function allocateExact(
  count: number,
  total: number,
  min: number,
  max: number,
  weightAt: (index: number) => number
): number[] {
  if (count <= 0) throw new Error('allocateExact requires at least one bucket');
  if (count * min > total || count * max < total) {
    throw new Error(`cannot allocate ${total} across ${count} buckets in [${min}, ${max}]`);
  }
  const values = new Array<number>(count).fill(min);
  let left = total - count * min;
  const weights = Array.from({ length: count }, (_, index) => Math.max(0.05, weightAt(index)));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (left * weight) / weightSum);
  const adds = raw.map((value) => Math.min(max - min, Math.floor(value)));
  let used = adds.reduce((sum, value) => sum + value, 0);
  const remainder = raw
    .map((value, index) => ({
      index,
      frac: value - Math.floor(value),
      room: max - min - (adds[index] ?? 0),
    }))
    .sort((a, b) => b.frac - a.frac);
  for (const item of remainder) {
    if (used >= left) break;
    if (item.room <= 0) continue;
    adds[item.index] = (adds[item.index] ?? 0) + 1;
    used += 1;
  }
  let guard = 0;
  while (used < left) {
    let moved = false;
    for (let index = 0; index < count && used < left; index += 1) {
      if ((adds[index] ?? 0) < max - min) {
        adds[index] = (adds[index] ?? 0) + 1;
        used += 1;
        moved = true;
      }
    }
    if (!moved || ++guard > count + 2) {
      throw new Error(`allocateExact stopped at ${used} of ${left}`);
    }
  }
  return values.map((value, index) => value + (adds[index] ?? 0));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
