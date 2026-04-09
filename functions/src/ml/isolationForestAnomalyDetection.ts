import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runIsolationForest, toDataPoint } from './isolationForest';

/**
 * Isolation Forest Anomaly Detection — pure TypeScript, no Python dependency.
 *
 * Supports three detection modes:
 *   transaction — single transaction vs historical transactions
 *   daily       — today's total vs historical daily totals
 *   weekly      — this week's total vs historical weekly totals
 */

// ─── Train / persist model metadata ──────────────────────────────────────────

export const trainIsolationForestModel = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, category, historicalData } = data;

    if (!userId || !category || !historicalData || historicalData.length < 30) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Need at least 30 data points to register model',
      );
    }

    // No model file to store — the algorithm runs on-the-fly from historical data.
    // We just record metadata so the client knows training is "done".
    await admin.firestore()
      .collection('ml_models')
      .doc(`${userId}_${category}`)
      .set({
        userId,
        category,
        trainedAt: admin.firestore.FieldValue.serverTimestamp(),
        dataPoints: historicalData.length,
        modelVersion: '2.0',
        algorithm: 'isolation_forest_ts',
        status: 'active',
      });

    return {
      success: true,
      message: `Model registered with ${historicalData.length} data points`,
      modelId: `${userId}_${category}`,
    };
  },
);

// ─── Detect anomaly ───────────────────────────────────────────────────────────

export const detectAnomalyWithIsolationForest = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const {
      userId,
      category,
      transaction,
      historicalData,
      detectionType = 'transaction',
    } = data;

    if (!userId || !category || !transaction) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    const history: any[] = historicalData ?? [];

    // Convert raw objects to DataPoints
    const historyPoints = history.map(toDataPoint);
    const targetPoint = toDataPoint(transaction);

    // Run Isolation Forest
    let result = runIsolationForest(targetPoint, historyPoints);

    // Only flag overspending — if the transaction is BELOW the historical average,
    // it's not an anomaly we care about (spending less is fine)
    if (result.isAnomaly && history.length >= 7) {
      const avgAmount = history.reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0) / history.length;
      if (transaction.amount < avgAmount) {
        result = {
          ...result,
          isAnomaly: false,
          severity: 'safe',
          message: 'Spending is below your usual amount — no alert needed',
        };
      }
    }

    // Persist detection log
    await admin.firestore()
      .collection('anomaly_detections')
      .add({
        userId,
        category,
        transaction,
        result,
        detectionType,
        detectedAt: admin.firestore.FieldValue.serverTimestamp(),
        algorithm: 'isolation_forest_ts',
      });

    return {
      isAnomaly: result.isAnomaly,
      anomalyScore: result.score,
      severity: result.severity,
      confidence: result.confidence,
      message: result.message,
      modelType: 'isolation_forest',
    };
  },
);

// ─── Model status ─────────────────────────────────────────────────────────────

export const getModelStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, category } = data;

    const modelDoc = await admin.firestore()
      .collection('ml_models')
      .doc(`${userId}_${category}`)
      .get();

    if (!modelDoc.exists) {
      return { exists: false, message: 'Model not registered yet' };
    }

    return { exists: true, ...modelDoc.data() };
  },
);
