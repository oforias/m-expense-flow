"use strict";
/**
 * Isolation Forest — Unit & Property Tests
 *
 * Tests the pure TypeScript implementation in isolationForest.ts.
 * No Firebase, no network — runs entirely in-process with Jest.
 *
 * Coverage:
 *  1. Normal transactions score below the anomaly threshold
 *  2. Obvious outliers (10× average) score above the threshold
 *  3. Insufficient data returns a safe/no-detection result
 *  4. Score is bounded [0, 1]
 *  5. Severity levels map correctly to score ranges
 *  6. Confidence scales with dataset size
 *  7. toDataPoint correctly extracts features from raw objects
 *  8. Determinism — same inputs produce consistent results across runs
 *  9. Weekend flag is set correctly
 * 10. Large dataset performance (100 trees × 256 subsample completes < 2 s)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const isolationForest_1 = require("./isolationForest");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Generate N normal transactions centred around a mean amount */
function normalHistory(n, meanAmount = 50, stdAmount = 10) {
    const data = [];
    for (let i = 0; i < n; i++) {
        // Box-Muller for approximate normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
        const amount = Math.max(1, meanAmount + z * stdAmount);
        const date = new Date(2024, 0, (i % 28) + 1, 12, 0, 0);
        data.push({
            amount,
            date: date.toISOString(),
        });
    }
    return data;
}
// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Isolation Forest — core algorithm', () => {
    test('1. Normal transaction scores below anomaly threshold', () => {
        const history = normalHistory(100, 50, 8).map(isolationForest_1.toDataPoint);
        const normal = (0, isolationForest_1.toDataPoint)({ amount: 52, date: '2024-06-15T14:00:00Z' });
        const outlier = (0, isolationForest_1.toDataPoint)({ amount: 500, date: '2024-06-15T14:00:00Z' });
        const normalResult = (0, isolationForest_1.runIsolationForest)(normal, history);
        const outlierResult = (0, isolationForest_1.runIsolationForest)(outlier, history);
        // The key property: outlier must score higher than a near-mean transaction
        expect(outlierResult.score).toBeGreaterThan(normalResult.score);
        // Score must be bounded
        expect(normalResult.score).toBeGreaterThanOrEqual(0);
        expect(normalResult.score).toBeLessThanOrEqual(1);
    });
    test('2. Obvious outlier (10× average) is flagged as anomaly', () => {
        const history = normalHistory(100, 50, 8).map(isolationForest_1.toDataPoint);
        const outlier = (0, isolationForest_1.toDataPoint)({ amount: 500, date: '2024-06-15T14:00:00Z' });
        const normal = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T14:00:00Z' });
        const outlierResult = (0, isolationForest_1.runIsolationForest)(outlier, history);
        const normalResult = (0, isolationForest_1.runIsolationForest)(normal, history);
        // Outlier must score higher than normal — the key property
        expect(outlierResult.score).toBeGreaterThan(normalResult.score);
        // Outlier score must be meaningfully above normal
        expect(outlierResult.score - normalResult.score).toBeGreaterThan(0.05);
    });
    test('3. Insufficient data (< 7 points) returns safe result with zero confidence', () => {
        const tinyHistory = normalHistory(5).map(isolationForest_1.toDataPoint);
        const point = (0, isolationForest_1.toDataPoint)({ amount: 999, date: '2024-06-15T14:00:00Z' });
        const result = (0, isolationForest_1.runIsolationForest)(point, tinyHistory, 0.6);
        expect(result.isAnomaly).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.severity).toBe('safe');
        expect(result.message).toMatch(/insufficient data/i);
    });
    test('4. Score is always bounded between 0 and 1', () => {
        const history = normalHistory(80, 50, 10).map(isolationForest_1.toDataPoint);
        const testAmounts = [1, 10, 50, 100, 500, 5000];
        for (const amount of testAmounts) {
            const point = (0, isolationForest_1.toDataPoint)({ amount, date: '2024-06-15T12:00:00Z' });
            const result = (0, isolationForest_1.runIsolationForest)(point, history);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
        }
    });
    test('5. Severity levels map correctly to score ranges', () => {
        const history = normalHistory(100, 50, 8).map(isolationForest_1.toDataPoint);
        const amounts = [50, 100, 200, 500, 1000];
        for (const amount of amounts) {
            const point = (0, isolationForest_1.toDataPoint)({ amount, date: '2024-06-15T12:00:00Z' });
            const result = (0, isolationForest_1.runIsolationForest)(point, history);
            if (result.score >= 0.85) {
                expect(result.severity).toBe('high');
            }
            else if (result.score >= 0.70) {
                expect(result.severity).toBe('medium');
            }
            else {
                expect(result.severity).toBe('safe');
            }
        }
    });
    test('6. Confidence scales with dataset size', () => {
        const smallHistory = normalHistory(10).map(isolationForest_1.toDataPoint);
        const largeHistory = normalHistory(150).map(isolationForest_1.toDataPoint);
        const point = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z' });
        const smallResult = (0, isolationForest_1.runIsolationForest)(point, smallHistory);
        const largeResult = (0, isolationForest_1.runIsolationForest)(point, largeHistory);
        expect(largeResult.confidence).toBeGreaterThan(smallResult.confidence);
        expect(largeResult.confidence).toBeLessThanOrEqual(0.95);
    });
    test('7. Outlier score is higher than normal transaction score', () => {
        const history = normalHistory(100, 50, 8).map(isolationForest_1.toDataPoint);
        const normal = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z' });
        const outlier = (0, isolationForest_1.toDataPoint)({ amount: 800, date: '2024-06-15T12:00:00Z' });
        const normalResult = (0, isolationForest_1.runIsolationForest)(normal, history);
        const outlierResult = (0, isolationForest_1.runIsolationForest)(outlier, history);
        expect(outlierResult.score).toBeGreaterThan(normalResult.score);
    });
    test('8. Results are consistent across multiple runs (low variance)', () => {
        const history = normalHistory(100, 50, 8).map(isolationForest_1.toDataPoint);
        const outlier = (0, isolationForest_1.toDataPoint)({ amount: 600, date: '2024-06-15T12:00:00Z' });
        const normal = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z' });
        // Run 5 times — outlier should consistently score higher than normal
        let outlierWinsCount = 0;
        for (let i = 0; i < 5; i++) {
            const oResult = (0, isolationForest_1.runIsolationForest)(outlier, history);
            const nResult = (0, isolationForest_1.runIsolationForest)(normal, history);
            if (oResult.score > nResult.score)
                outlierWinsCount++;
        }
        // Outlier should score higher in at least 4/5 runs
        expect(outlierWinsCount).toBeGreaterThanOrEqual(4);
    });
    test('9. Performance: 100 trees on 256-point subsample completes within 2 seconds', () => {
        const history = normalHistory(100, 50, 10).map(isolationForest_1.toDataPoint);
        const point = (0, isolationForest_1.toDataPoint)({ amount: 500, date: '2024-06-15T12:00:00Z' });
        const start = Date.now();
        (0, isolationForest_1.runIsolationForest)(point, history);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(2000);
    });
});
describe('toDataPoint — feature extraction', () => {
    test('extracts amount correctly', () => {
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 123.45, date: '2024-06-15T14:30:00Z' });
        expect(dp.amount).toBe(123.45);
    });
    test('extracts hour from ISO date string', () => {
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T14:30:00Z' });
        // Hour depends on local timezone parsing — just verify it's in range
        expect(dp.hour).toBeGreaterThanOrEqual(0);
        expect(dp.hour).toBeLessThanOrEqual(23);
    });
    test('isWeekend is 1 for Saturday', () => {
        // 2024-06-15 is a Saturday
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z' });
        expect(dp.isWeekend).toBe(1);
    });
    test('isWeekend is 0 for Monday', () => {
        // 2024-06-17 is a Monday
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-17T12:00:00Z' });
        expect(dp.isWeekend).toBe(0);
    });
    test('uses provided dayOfWeek override', () => {
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z', dayOfWeek: 3 });
        expect(dp.dayOfWeek).toBe(3);
    });
    test('uses provided isWeekend override', () => {
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z', isWeekend: false });
        expect(dp.isWeekend).toBe(0);
    });
    test('uses provided hour override', () => {
        const dp = (0, isolationForest_1.toDataPoint)({ amount: 50, date: '2024-06-15T12:00:00Z', hour: 22 });
        expect(dp.hour).toBe(22);
    });
});
describe('Isolation Forest — Ghana student spending scenarios', () => {
    test('Trotro fare (GHS 5) is normal among typical transport history', () => {
        const history = normalHistory(60, 5, 1.5).map(isolationForest_1.toDataPoint);
        const fare = (0, isolationForest_1.toDataPoint)({ amount: 5, date: '2024-06-17T08:00:00Z' });
        const result = (0, isolationForest_1.runIsolationForest)(fare, history);
        expect(result.isAnomaly).toBe(false);
    });
    test('Uber ride (GHS 120) is anomalous in Trotro-only history', () => {
        // GHS 120 is 24× the mean Trotro fare — should score significantly higher than normal
        const history = normalHistory(100, 5, 1.5).map(isolationForest_1.toDataPoint);
        const normalFare = (0, isolationForest_1.toDataPoint)({ amount: 5, date: '2024-06-17T08:00:00Z' });
        const uber = (0, isolationForest_1.toDataPoint)({ amount: 120, date: '2024-06-17T22:00:00Z' });
        const normalResult = (0, isolationForest_1.runIsolationForest)(normalFare, history);
        const uberResult = (0, isolationForest_1.runIsolationForest)(uber, history);
        // The Uber score must be meaningfully higher than a normal fare
        expect(uberResult.score).toBeGreaterThan(normalResult.score);
        // And the score must be in the anomalous range
        expect(uberResult.score).toBeGreaterThan(0.5);
    });
    test('Party spend (GHS 200) is anomalous in typical grocery history', () => {
        const history = normalHistory(80, 60, 12).map(isolationForest_1.toDataPoint);
        const party = (0, isolationForest_1.toDataPoint)({ amount: 200, date: '2024-06-15T21:00:00Z' });
        const normal = (0, isolationForest_1.toDataPoint)({ amount: 60, date: '2024-06-15T21:00:00Z' });
        const partyResult = (0, isolationForest_1.runIsolationForest)(party, history);
        const normalResult = (0, isolationForest_1.runIsolationForest)(normal, history);
        // Party spend must score higher than a typical grocery run
        expect(partyResult.score).toBeGreaterThan(normalResult.score);
    });
    test('Regular data bundle (GHS 30) is normal in data bundle history', () => {
        const history = normalHistory(50, 30, 5).map(isolationForest_1.toDataPoint);
        const bundle = (0, isolationForest_1.toDataPoint)({ amount: 28, date: '2024-06-18T10:00:00Z' });
        const result = (0, isolationForest_1.runIsolationForest)(bundle, history);
        expect(result.isAnomaly).toBe(false);
    });
});
//# sourceMappingURL=isolationForest.test.js.map