/**
 * Circle-specific compatibility scoring.
 *
 * Reuses the same algorithmic primitives as the dating pipeline
 * but operates on circle-specific questions with per-question weights.
 */

interface CircleQuestion {
  key: string;
  type: 'scale' | 'single_choice' | 'multi_choice' | 'ranking';
  weight: number;
}

interface Answer {
  value: number | string | string[];
  importance?: number;
}

type Answers = Record<string, Answer>;

// ── Scoring primitives ──────────────────────────────────────────

function scaleSimilarity(a: Answer, b: Answer): number {
  if (typeof a.value !== 'number' || typeof b.value !== 'number') return 0;
  const diff = Math.abs(a.value - b.value);
  // Assume 7-point scale; normalise penalty to [0,1]
  const maxDiff = 6;
  const raw = 1 - diff / maxDiff;

  // Importance-weighted: average both sides' importance
  const impA = a.importance ?? 1;
  const impB = b.importance ?? 1;
  const avgImp = (impA + impB) / 2;

  // Higher importance amplifies the distance (more decisive)
  return raw ** (1 + (avgImp - 1) * 0.3);
}

function singleChoiceMatch(a: Answer, b: Answer): number {
  return a.value === b.value ? 1 : 0;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

function spearmanCorrelation(a: string[], b: string[]): number {
  const n = a.length;
  if (n <= 1) return 1;

  const rankA = new Map(a.map((item, idx) => [item, idx + 1]));
  const rankB = new Map(b.map((item, idx) => [item, idx + 1]));

  let sumDSquared = 0;
  for (const item of a) {
    const rA = rankA.get(item) ?? 0;
    const rB = rankB.get(item) ?? 0;
    sumDSquared += (rA - rB) ** 2;
  }

  const rho = 1 - (6 * sumDSquared) / (n * (n * n - 1));
  // Normalise from [-1,1] to [0,1]
  return (rho + 1) / 2;
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Compute compatibility score between two circle members.
 *
 * @returns score in [0, 1]
 */
export function computeCircleScore(
  answersA: Answers,
  answersB: Answers,
  questions: CircleQuestion[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const q of questions) {
    const a = answersA[q.key];
    const b = answersB[q.key];
    if (!a || !b) continue;

    let similarity: number;

    switch (q.type) {
      case 'scale':
        similarity = scaleSimilarity(a, b);
        break;
      case 'single_choice':
        similarity = singleChoiceMatch(a, b);
        break;
      case 'multi_choice':
        if (!Array.isArray(a.value) || !Array.isArray(b.value)) continue;
        similarity = jaccardSimilarity(a.value, b.value);
        break;
      case 'ranking':
        if (!Array.isArray(a.value) || !Array.isArray(b.value)) continue;
        similarity = spearmanCorrelation(a.value, b.value);
        break;
      default:
        continue;
    }

    weightedSum += similarity * q.weight;
    totalWeight += q.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
