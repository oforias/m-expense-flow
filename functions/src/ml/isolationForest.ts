/**
 * Isolation Forest — pure TypeScript implementation
 *
 * Reference: Liu, Fei Tony, Kai Ming Ting, and Zhi-Hua Zhou.
 * "Isolation forest." ICDM 2008.
 *
 * Key formula: score(x, n) = 2^( -E[h(x)] / c(n) )
 *   where c(n) = 2*H(n-1) - 2*(n-1)/n  (average path length of BST on n nodes)
 *   and   H(i) = ln(i) + 0.5772156649   (Euler–Mascheroni constant)
 *
 * IMPORTANT: c must always be computed with the SUBSAMPLE_SIZE (ψ), NOT the
 * actual dataset size. Using the actual size when data < ψ inflates scores
 * for normal points and causes false negatives.
 */

interface DataPoint {
  amount: number;
  dayOfWeek: number;   // 0–6
  isWeekend: number;   // 0 or 1
  hour: number;        // 0–23
}

interface IsolationTreeNode {
  isLeaf: boolean;
  size: number;
  featureIndex?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
}

const FEATURES: (keyof DataPoint)[] = ['amount', 'dayOfWeek', 'isWeekend', 'hour'];
const NUM_TREES = 100;
const SUBSAMPLE_SIZE = 256;

/** c(n): expected average path length of an unsuccessful BST search on n nodes */
function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // H(n-1) = ln(n-1) + γ
  return 2 * H - (2 * (n - 1)) / n;
}

function buildTree(data: DataPoint[], depth: number, maxDepth: number): IsolationTreeNode {
  if (data.length <= 1 || depth >= maxDepth) {
    return { isLeaf: true, size: data.length };
  }

  // Uniform random feature selection — as per the original paper.
  // Variance-weighted selection biases the score distribution and causes
  // normal points to score too high when one feature dominates.
  const featureIdx = Math.floor(Math.random() * FEATURES.length);
  const featureKey = FEATURES[featureIdx];
  const values = data.map(d => d[featureKey] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return { isLeaf: true, size: data.length };
  }

  const splitValue = min + Math.random() * (max - min);
  const left = data.filter(d => (d[featureKey] as number) < splitValue);
  const right = data.filter(d => (d[featureKey] as number) >= splitValue);

  if (left.length === 0 || right.length === 0) {
    return { isLeaf: true, size: data.length };
  }

  return {
    isLeaf: false,
    size: data.length,
    featureIndex: featureIdx,
    splitValue,
    left: buildTree(left, depth + 1, maxDepth),
    right: buildTree(right, depth + 1, maxDepth),
  };
}

function pathLength(point: DataPoint, node: IsolationTreeNode, currentDepth: number): number {
  if (node.isLeaf) {
    return currentDepth + c(node.size);
  }
  const featureKey = FEATURES[node.featureIndex!];
  const val = point[featureKey] as number;
  if (val < node.splitValue!) {
    return pathLength(point, node.left!, currentDepth + 1);
  } else {
    return pathLength(point, node.right!, currentDepth + 1);
  }
}

function subsample(data: DataPoint[], size: number): DataPoint[] {
  if (data.length <= size) return [...data];
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

export interface IsolationForestResult {
  score: number;
  isAnomaly: boolean;
  severity: 'safe' | 'medium' | 'high';
  confidence: number;
  message: string;
}

export function runIsolationForest(
  point: DataPoint,
  historicalData: DataPoint[],
  threshold = 0.62,
): IsolationForestResult {
  if (historicalData.length < 7) {
    return {
      score: 0,
      isAnomaly: false,
      severity: 'safe',
      confidence: 0,
      message: 'Insufficient data for anomaly detection (need 7+ transactions)',
    };
  }

  // maxDepth is derived from SUBSAMPLE_SIZE (ψ), not actual data size.
  const maxDepth = Math.ceil(Math.log2(SUBSAMPLE_SIZE));

  // c(ψ) — the normalisation constant. MUST use SUBSAMPLE_SIZE, not data.length.
  // Using data.length when data.length < ψ makes c smaller, inflating scores
  // for normal points and producing false negatives.
  const cPsi = c(SUBSAMPLE_SIZE);

  const trees: IsolationTreeNode[] = [];
  for (let i = 0; i < NUM_TREES; i++) {
    const sample = subsample(historicalData, SUBSAMPLE_SIZE);
    trees.push(buildTree(sample, 0, maxDepth));
  }

  const avgPath =
    trees.reduce((sum, tree) => sum + pathLength(point, tree, 0), 0) / NUM_TREES;

  // score(x) = 2^( -E[h(x)] / c(ψ) )
  // Normal points: avgPath ≈ c(ψ)  → score ≈ 0.5
  // Anomalies:     avgPath << c(ψ) → score → 1.0
  const score = cPsi === 0 ? 0 : Math.pow(2, -avgPath / cPsi);

  const isAnomaly = score >= threshold;
  let severity: 'safe' | 'medium' | 'high' = 'safe';
  if (score >= 0.75) severity = 'high';
  else if (score >= threshold) severity = 'medium';

  const confidence = Math.min(0.95, 0.5 + historicalData.length / 200);

  const message = isAnomaly
    ? `Unusual transaction detected (score: ${score.toFixed(3)})`
    : 'Transaction is within normal spending patterns';

  return { score, isAnomaly, severity, confidence, message };
}

export function toDataPoint(t: {
  amount: number;
  date: string;
  dayOfWeek?: number;
  isWeekend?: boolean;
  hour?: number;
}): DataPoint {
  const d = new Date(t.date);
  return {
    amount: t.amount,
    dayOfWeek: t.dayOfWeek ?? d.getDay(),
    isWeekend: (t.isWeekend != null ? t.isWeekend : (d.getDay() === 0 || d.getDay() === 6)) ? 1 : 0,
    hour: t.hour ?? d.getHours(),
  };
}
