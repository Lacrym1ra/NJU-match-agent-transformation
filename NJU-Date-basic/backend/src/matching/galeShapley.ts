/**
 * Greedy maximum-weight bipartite matching with augmenting-path cardinality rescue.
 *
 * Phase 1 — Greedy (O(N² log N)):
 *   Sort all valid pairs by compatibility score descending.
 *   Assign greedily — maximises total weight.
 *
 * Phase 2 — Augmenting paths (O(V·E)):
 *   For each still-unmatched proposer, run a DFS to find an alternating path
 *   that frees up a receiver.  Rescues users "blocked" in phase 1 and
 *   maximises the number of matched pairs (cardinality) after weight is settled.
 *
 * Total: O(N² log N) — suitable for pools of tens of thousands.
 */

export interface MatchPair {
  proposerId: string;
  receiverId: string;
  score: number;
}

export interface MatchingStats {
  /** Total number of users across both sides of this pool. */
  eligible: number;
  /** Number of users who received a match (pairs × 2). */
  matched: number;
  /** Users left without a match. */
  unmatched: number;
  /** matched / eligible, range [0, 1]. */
  matchRate: number;
  /** Mean compatibility score of all matched pairs. */
  avgScore: number;
  /**
   * Sum of the best available score for every unmatched user.
   * Represents the compatibility "left on the table" — useful for
   * monitoring whether dealbreaker settings are too strict.
   */
  weightLoss: number;
}

/**
 * Find maximum-weight bipartite matching, then rescue unmatched users via
 * augmenting paths to maximise cardinality.
 *
 * @param minScore  Pairs scoring below this threshold are excluded entirely.
 *                  Keeps match quality high — better to leave someone unmatched
 *                  than pair them with a poor fit.  Default 0 (no threshold).
 */
export function greedyMaxWeightMatching(
  proposerIds: string[],
  receiverIds: string[],
  scores: Map<string, number>,
  minScore = 0,
): { pairs: MatchPair[]; stats: MatchingStats } {
  const n = proposerIds.length;
  const m = receiverIds.length;
  const eligible = n + m;

  if (n === 0 || m === 0) {
    return {
      pairs: [],
      stats: { eligible, matched: 0, unmatched: eligible, matchRate: 0, avgScore: 0, weightLoss: 0 },
    };
  }

  // ── Collect all valid (score > 0) pairs ──────────────────────────────────
  const allPairs: { pIdx: number; rIdx: number; score: number }[] = [];
  const pBestScore = new Array<number>(n).fill(0);
  const rBestScore = new Array<number>(m).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const score = scores.get(`${proposerIds[i]}:${receiverIds[j]}`) ?? 0;
      if (score > 0 && score >= minScore) {
        allPairs.push({ pIdx: i, rIdx: j, score });
        if (score > pBestScore[i]) pBestScore[i] = score;
        if (score > rBestScore[j]) rBestScore[j] = score;
      }
    }
  }

  // ── Phase 1: Greedy assignment by score ──────────────────────────────────
  allPairs.sort((a, b) => b.score - a.score);

  const pMatch = new Int32Array(n).fill(-1); // pMatch[i] = receiver index
  const rMatch = new Int32Array(m).fill(-1); // rMatch[j] = proposer index

  for (const { pIdx, rIdx } of allPairs) {
    if (pMatch[pIdx] === -1 && rMatch[rIdx] === -1) {
      pMatch[pIdx] = rIdx;
      rMatch[rIdx] = pIdx;
    }
  }

  // ── Phase 2: Augmenting paths for unmatched proposers ────────────────────
  // Build sorted adjacency lists (descending score) for each proposer
  const pAdj: Int32Array[] = proposerIds.map((_, i) => {
    const neighbors = allPairs
      .filter((p) => p.pIdx === i)
      .map((p) => p.rIdx); // already sorted by score from phase 1 sort
    return new Int32Array(neighbors);
  });

  function augment(pIdx: number, visited: Uint8Array): boolean {
    for (const rIdx of pAdj[pIdx]) {
      if (!visited[rIdx]) {
        visited[rIdx] = 1;
        const currentP = rMatch[rIdx];
        if (currentP === -1 || augment(currentP, visited)) {
          pMatch[pIdx] = rIdx;
          rMatch[rIdx] = pIdx;
          return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < n; i++) {
    if (pMatch[i] === -1) {
      const visited = new Uint8Array(m);
      augment(i, visited);
    }
  }

  // ── Build result ─────────────────────────────────────────────────────────
  const pairs: MatchPair[] = [];
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const j = pMatch[i];
    if (j !== -1) {
      const score = scores.get(`${proposerIds[i]}:${receiverIds[j]}`) ?? 0;
      pairs.push({ proposerId: proposerIds[i], receiverId: receiverIds[j], score });
      totalScore += score;
    }
  }

  // Weight loss: sum of best available score for each unmatched user
  let weightLoss = 0;
  for (let i = 0; i < n; i++) {
    if (pMatch[i] === -1) weightLoss += pBestScore[i];
  }
  for (let j = 0; j < m; j++) {
    if (rMatch[j] === -1) weightLoss += rBestScore[j];
  }

  const matched = pairs.length * 2;
  return {
    pairs,
    stats: {
      eligible,
      matched,
      unmatched: eligible - matched,
      matchRate: eligible > 0 ? matched / eligible : 0,
      avgScore: pairs.length > 0 ? Math.round((totalScore / pairs.length) * 100) / 100 : 0,
      weightLoss: Math.round(weightLoss * 100) / 100,
    },
  };
}
