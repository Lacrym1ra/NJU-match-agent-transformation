/**
 * Pool partitioning — splits participants into matching sub-pools
 * based on gender preference pairs.
 *
 * This dramatically reduces computation: instead of N×N comparisons,
 * we do M×K comparisons per pool where M,K << N.
 */

export interface Participant {
  id: string;
  gender: string;
  genderPref: string;
  department?: string | null;
  campus?: string | null;
  grade?: string | null;
  mbti?: string | null;
}

export interface MatchPool {
  key: string;
  groupA: Participant[]; // "proposers" in Gale-Shapley
  groupB: Participant[]; // "receivers" in Gale-Shapley
}

/**
 * Partition participants into matching pools.
 *
 * Pool key format: "proposerGender->receiverGender"
 * Example pools:
 *   - male->female × female->male (heterosexual)
 *   - male->male × male->male (homosexual)
 *   - any combinations with 'any' preference
 */
export function partitionIntoPools(participants: Participant[]): MatchPool[] {
  // Group by (gender, genderPref)
  const groups = new Map<string, Participant[]>();
  for (const p of participants) {
    const key = `${p.gender}:${p.genderPref}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const pools: MatchPool[] = [];
  const processedPairs = new Set<string>();

  const groupKeys = [...groups.keys()];

  for (const keyA of groupKeys) {
    const [genderA, prefA] = keyA.split(':');

    for (const keyB of groupKeys) {
      const [genderB, prefB] = keyB.split(':');

      // Check if these two groups can match with each other
      const aPrefersB = prefA === 'any' || prefA === genderB;
      const bPrefersA = prefB === 'any' || prefB === genderA;

      if (!aPrefersB || !bPrefersA) continue;

      // Avoid duplicate pools
      const pairKey = [keyA, keyB].sort().join('|');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const groupAMembers = groups.get(keyA) ?? [];
      const groupBMembers = groups.get(keyB) ?? [];

      if (keyA === keyB) {
        // Same group matching (e.g., male->male × male->male)
        // Split into two halves for Gale-Shapley
        const shuffled = [...groupAMembers].sort(() => Math.random() - 0.5);
        const mid = Math.ceil(shuffled.length / 2);
        pools.push({
          key: `${keyA}|self`,
          groupA: shuffled.slice(0, mid),
          groupB: shuffled.slice(mid),
        });
      } else {
        pools.push({
          key: pairKey,
          groupA: groupAMembers,
          groupB: groupBMembers,
        });
      }
    }
  }

  return pools;
}
