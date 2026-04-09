/**
 * Isolation Forest — pure TypeScript implementation
 *
 * How it works:
 * - Build N random "isolation trees" by recursively splitting data on random
 *   feature/value pairs until each point is isolated.
 * - Anomalies are isolated in fewer splits (shorter path length).
 * - Average path length across all trees → anomaly score.
 * - Score close to 1 = anomaly, close to 0 = normal.
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

// All 4 features are needed for correct score calibration.
// With only 1 feature, the algorithm degenerates into a sorted binary search
// and normal points score ~0.6 instead of the expected ~0.5.
// Multiple features with random splits produce the correct score distribution.
const FEATURES: (keyof DataPoint)[] = ['amount', 'dayOfWeek', 'isWeekend', 'hour'];
const NUM_TREES = 100;
const SUBSAMPLE_SIZE = 256;

// Expected average path length for a dataset of size n
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  // Harmonic number approximation
  const H = Math.log(n - 1) + 0.5772156649;
  return 2 * H - (2 * (n - 1)) / n;
}

function buildTree(data: DataPoint[], depth: number, maxDepth: number): IsolationTreeNode {
  if (data.length <= 1 || depth >= maxDepth) {
    return { isLeaf: true, size: data.length };
  }

  // Variance-weighted feature selection:
  // Features with more spread get selected more often.
  // This ensures amount dominates when it's the discriminating feature,
  // while still using all features to maintain correct score calibration.
  const featureVariances = FEATURES.map(key => {
    const vals = data.map(d => d[key] as number);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.max(0.01, vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  });
  const totalVariance = featureVariances.reduce((a, b) => a + b, 0);

  let r = Math.random() * totalVariance;
  let featureIdx = 0;
  for (let i = 0; i < featureVariances.length; i++) {
    r -= featureVariances[i];
    if (r <= 0) { featureIdx = i; break; }
  }

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
    return currentDepth + averagePathLength(node.size);
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
  if (data.length <= size) return data;
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

export interface IsolationForestResult {
  score: number;       // 0–1, higher = more anomalous
  isAnomaly: boolean;
  severity: 'safe' | 'medium' | 'high';
  confidence: number;
  message: string;
}

export function runIsolationForest(
  point: DataPoint,
  historicalData: DataPoint[],
  threshold = 0.70,
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

  // maxDepth and c must use SUBSAMPLE_SIZE as per the original paper
  // This ensures the score formula is calibrated correctly regardless of dataset size
  const psiSize = Math.min(SUBSAMPLE_SIZE, historicalData.length);
  const maxDepth = Math.ceil(Math.log2(psiSize));
  const trees: IsolationTreeNode[] = [];

  for (let i = 0; i < NUM_TREES; i++) {
    const sample = subsample(historicalData, SUBSAMPLE_SIZE);
    trees.push(buildTree(sample, 0, maxDepth));
  }

  // Standard Isolation Forest scoring: 2^(-avgPath/c)
  // c(psi) is the expected average path length for a dataset of size psi
  // A normal point scores ~0.5, an anomaly scores closer to 1.0
  const avgPath = trees.reduce((sum, tree) => sum + pathLength(point, tree, 0), 0) / NUM_TREES;
  const c = averagePathLength(psiSize);
  const score = c === 0 ? 0 : Math.pow(2, -avgPath / c);

  const isAnomaly = score >= threshold;
  let severity: 'safe' | 'medium' | 'high' = 'safe';
  if (score >= 0.85) severity = 'high';
  else if (score >= threshold) severity = 'medium';

  // Confidence scales with data size
  const confidence = Math.min(0.95, 0.5 + historicalData.length / 200);

  const message = isAnomaly
    ? `Unusual transaction detected (anomaly score: ${score.toFixed(2)})`
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
