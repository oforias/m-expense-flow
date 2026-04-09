"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoricalRecommendationActions = exports.getRecommendationModelStatus = exports.getRecommendationMetrics = exports.recordRecommendationAction = exports.trainPersonalizedRecommendationModel = exports.generateMLRecommendations = void 0;
const functions = require("firebase-functions");
const child_process_1 = require("child_process");
const path = require("path");
/**
 * ML-based Personalized Recommendation System
 *
 * Cloud Functions that wrap the Python ML recommendation engine.
 * Uses the same spawn pattern as isolationForestAnomalyDetection.ts.
 */
function callPythonMLService(command, payload) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, 'python', 'ml_recommendations.py');
        const python = (0, child_process_1.spawn)('python3', [pythonScript]);
        let output = '';
        let errorOutput = '';
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { errorOutput += data.toString(); });
        python.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python ML service failed (exit ${code}): ${errorOutput}`));
            }
            else {
                try {
                    resolve(JSON.parse(output));
                }
                catch (e) {
                    reject(new Error(`Failed to parse Python output: ${output}`));
                }
            }
        });
        python.on('error', (err) => {
            reject(new Error(`Failed to spawn Python process: ${err.message}`));
        });
        python.stdin.write(JSON.stringify({ command, payload }));
        python.stdin.end();
    });
}
exports.generateMLRecommendations = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, behaviorData, snapshot, maxRecommendations = 5 } = data;
    if (!userId || !behaviorData || !snapshot) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: userId, behaviorData, snapshot');
    }
    try {
        const result = await callPythonMLService('generate_recommendations', { userId, behaviorData, snapshot, maxRecommendations });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('generateMLRecommendations failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate ML recommendations', error);
    }
});
exports.trainPersonalizedRecommendationModel = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, trainingData } = data;
    if (!userId || !trainingData) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: userId, trainingData');
    }
    try {
        const result = await callPythonMLService('train_model', { userId, trainingData });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('trainPersonalizedRecommendationModel failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to train recommendation model', error);
    }
});
exports.recordRecommendationAction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, recommendationId, action, timestamp, metadata } = data;
    if (!userId || !recommendationId || !action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: userId, recommendationId, action');
    }
    try {
        const result = await callPythonMLService('record_action', {
            userId, recommendationId, action,
            timestamp: timestamp || new Date().toISOString(),
            metadata: metadata || {},
        });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('recordRecommendationAction failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to record recommendation action', error);
    }
});
exports.getRecommendationMetrics = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: userId');
    }
    try {
        const result = await callPythonMLService('get_metrics', { userId });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('getRecommendationMetrics failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get recommendation metrics', error);
    }
});
exports.getRecommendationModelStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: userId');
    }
    try {
        const result = await callPythonMLService('get_model_status', { userId });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('getRecommendationModelStatus failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get model status', error);
    }
});
exports.getHistoricalRecommendationActions = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: userId');
    }
    try {
        const result = await callPythonMLService('get_historical_actions', { userId });
        if (result.error)
            throw new Error(result.error);
        return result;
    }
    catch (error) {
        console.error('getHistoricalRecommendationActions failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get historical actions', error);
    }
});
//# sourceMappingURL=mlRecommendations.js.map