// =====================================================================
//  GRC Group Builder — splits members into fair, balanced groups using
//  the anonymous preference survey.
//
//  Each student rates classmates 1–5 ("how much would you like to be in
//  a group with them"). Unrated = 3 (neutral).
//
//  Objective (higher is better):
//    • Pair score: for every pair in the same group, (r(a→b) − 3) + (r(b→a) − 3)
//      → mutual wishes count double, a "1" pulls strongly apart.
//    • Fairness: we add a bonus for the least-happy person, so nobody is
//      left in a group where they know no one they wanted.
//  Groups are always balanced (sizes differ by at most 1).
//  Search: many random starts + swap/move hill-climbing. Fast for < 100 people.
// =====================================================================

export const NEUTRAL = 3;

export function buildMatrix(ids, ratings) {
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const R = Array.from({ length: n }, () => new Array(n).fill(NEUTRAL));
  for (const r of ratings) {
    const a = index.get(r.rater_id), b = index.get(r.ratee_id);
    if (a !== undefined && b !== undefined && a !== b) R[a][b] = Number(r.score);
  }
  return R;
}

function pairWeight(R, a, b) { return (R[a][b] - NEUTRAL) + (R[b][a] - NEUTRAL); }

// Average rating a person gave to their group mates (their "happiness").
export function happiness(R, a, group) {
  const mates = group.filter(x => x !== a);
  if (!mates.length) return NEUTRAL;
  return mates.reduce((s, b) => s + R[a][b], 0) / mates.length;
}

// Did this person get at least one group mate they rated 4 or 5?
export function gotAWish(R, a, group) {
  return group.some(b => b !== a && R[a][b] >= 4);
}

const FAIRNESS = 4; // weight of the "least happy person" term

function score(R, groups) {
  let total = 0, minH = Infinity;
  for (const g of groups) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) total += pairWeight(R, g[i], g[j]);
      minH = Math.min(minH, happiness(R, g[i], g));
    }
  }
  if (minH === Infinity) minH = NEUTRAL;
  return total + FAIRNESS * minH * groups.length;
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string[]} ids        member ids
 * @param {{rater_id,ratee_id,score}[]} ratings
 * @param {number} k            number of groups
 * @param {{restarts?:number, seed?:number}} opts
 * @returns {{groups:string[][], score:number, stats:object}}
 */
export function makeGroups(ids, ratings, k, opts = {}) {
  const n = ids.length;
  k = Math.max(1, Math.min(k, n || 1));
  if (!n) return { groups: Array.from({ length: k }, () => []), score: 0, stats: emptyStats() };

  const R = buildMatrix(ids, ratings);
  const rnd = mulberry32(opts.seed ?? 20261011);
  const restarts = opts.restarts ?? Math.round(Math.max(15, Math.min(300, 8000 / Math.pow(n, 1.5))));
  const base = Math.floor(n / k), extra = n % k;
  const sizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));

  let best = null, bestScore = -Infinity;

  for (let r = 0; r < restarts; r++) {
    const order = shuffle([...Array(n).keys()], rnd);
    const groups = []; let p = 0;
    for (const s of sizes) { groups.push(order.slice(p, p + s)); p += s; }
    let cur = score(R, groups);

    let improved = true;
    while (improved) {
      improved = false;
      for (let g1 = 0; g1 < k; g1++) for (let g2 = g1 + 1; g2 < k; g2++) {
        for (let i = 0; i < groups[g1].length; i++) for (let j = 0; j < groups[g2].length; j++) {
          const a = groups[g1][i], b = groups[g2][j];
          groups[g1][i] = b; groups[g2][j] = a;
          const s = score(R, groups);
          if (s > cur + 1e-9) { cur = s; improved = true; }
          else { groups[g1][i] = a; groups[g2][j] = b; }
        }
      }
      // single-person moves from a bigger group (base+1) to a smaller one (base):
      // the sizes just trade places, so groups stay balanced
      for (let g1 = 0; g1 < k; g1++) for (let g2 = 0; g2 < k; g2++) {
        if (g1 === g2 || groups[g1].length !== groups[g2].length + 1) continue;
        for (let i = 0; i < groups[g1].length; i++) {
          const a = groups[g1][i];
          groups[g1].splice(i, 1); groups[g2].push(a);
          const s = score(R, groups);
          if (s > cur + 1e-9) { cur = s; improved = true; break; }
          groups[g2].pop(); groups[g1].splice(i, 0, a);
        }
      }
    }
    if (cur > bestScore) { bestScore = cur; best = groups.map(g => [...g]); }
  }

  const out = best.map(g => g.map(i => ids[i]));
  return { groups: out, score: bestScore, stats: evaluate(ids, ratings, out) };
}

function emptyStats() { return { avgHappiness: NEUTRAL, minHappiness: NEUTRAL, wishRate: 0, conflicts: 0, perPerson: {} }; }

/** Evaluate any grouping (also used after manual edits). */
export function evaluate(ids, ratings, groups) {
  const R = buildMatrix(ids, ratings);
  const index = new Map(ids.map((id, i) => [id, i]));
  const perPerson = {};
  let sum = 0, min = Infinity, wishes = 0, count = 0, conflicts = 0;
  const groupStats = groups.map(g => {
    const idx = g.map(id => index.get(id)).filter(x => x !== undefined);
    let gs = 0;
    for (const a of idx) {
      const h = happiness(R, a, idx);
      const w = gotAWish(R, a, idx);
      perPerson[ids[a]] = { happiness: h, gotWish: w };
      sum += h; min = Math.min(min, h); count++; gs += h;
      if (w) wishes++;
      for (const b of idx) if (b !== a && R[a][b] <= 1) conflicts++;
    }
    return { size: idx.length, avgHappiness: idx.length ? gs / idx.length : NEUTRAL };
  });
  return {
    avgHappiness: count ? sum / count : NEUTRAL,
    minHappiness: count ? min : NEUTRAL,
    wishRate: count ? wishes / count : 0,
    conflicts,
    perPerson,
    groupStats,
  };
}

/** Suggested number of groups for n people, given ideal size limits. */
export function suggestGroupCount(n, { min = 4, max = 6, atLeast = 4 } = {}) {
  if (n <= 0) return atLeast;
  let k = Math.max(atLeast, Math.ceil(n / max));
  while (k > 1 && Math.floor(n / k) < min - 1) k--; // avoid tiny groups (allow min-1)
  return Math.max(1, Math.min(k, n));
}
