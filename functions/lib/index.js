"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAchievements = exports.getModelStatus = exports.detectAnomalyWithIsolationForest = exports.trainIsolationForestModel = exports.checkBudgetOnTransaction = exports.cleanupOldNotifications = exports.sendStreakRiskReminders = exports.sendStreakReminders = exports.sendNotification = exports.checkTrialExpiration = exports.upgradeFromTrial = exports.scheduleTrialReminder = exports.cancelTrialOnUpgrade = exports.startFreeTrial = exports.verifyPayment = exports.paystackWebhook = exports.processPayment = exports.generateDataExport = exports.enforceTrackerLimits = exports.manageSubscription = exports.verifySubscription = exports.testGeminiAI = exports.explainAnomaly = exports.triggerPeerDataAggregation = exports.aggregatePeerData = exports.triggerPeerAveragesCalculation = exports.calculatePeerAverages = exports.generateComparativeInsights = exports.detectSpendingAnomalies = exports.generateStudentRecommendations = exports.analyzeSpendingPatterns = exports.awardXP = exports.generateChallenges = exports.updateLeaderboard = exports.checkAchievements = exports.resetMonthlyLeaderboard = exports.resetLeaderboards = exports.calculateProfitMargin = exports.applyBusinessTemplate = exports.enableBusinessMode = exports.generateBusinessInsights = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK
admin.initializeApp();
// Import already-wrapped Cloud Functions
var generateBusinessInsights_1 = require("./business/generateBusinessInsights");
Object.defineProperty(exports, "generateBusinessInsights", { enumerable: true, get: function () { return generateBusinessInsights_1.generateBusinessInsights; } });
var enableBusinessMode_1 = require("./business/enableBusinessMode");
Object.defineProperty(exports, "enableBusinessMode", { enumerable: true, get: function () { return enableBusinessMode_1.enableBusinessMode; } });
var applyBusinessTemplate_1 = require("./business/applyBusinessTemplate");
Object.defineProperty(exports, "applyBusinessTemplate", { enumerable: true, get: function () { return applyBusinessTemplate_1.applyBusinessTemplate; } });
var calculateProfitMargin_1 = require("./business/calculateProfitMargin");
Object.defineProperty(exports, "calculateProfitMargin", { enumerable: true, get: function () { return calculateProfitMargin_1.calculateProfitMargin; } });
var updateLeaderboard_1 = require("./gamification/updateLeaderboard");
Object.defineProperty(exports, "resetLeaderboards", { enumerable: true, get: function () { return updateLeaderboard_1.resetLeaderboards; } });
Object.defineProperty(exports, "resetMonthlyLeaderboard", { enumerable: true, get: function () { return updateLeaderboard_1.resetMonthlyLeaderboard; } });
var checkAchievements_1 = require("./gamification/checkAchievements");
Object.defineProperty(exports, "checkAchievements", { enumerable: true, get: function () { return checkAchievements_1.checkAchievements; } });
var updateLeaderboard_2 = require("./gamification/updateLeaderboard");
Object.defineProperty(exports, "updateLeaderboard", { enumerable: true, get: function () { return updateLeaderboard_2.updateLeaderboard; } });
var generateChallenges_1 = require("./gamification/generateChallenges");
Object.defineProperty(exports, "generateChallenges", { enumerable: true, get: function () { return generateChallenges_1.generateChallenges; } });
var awardXP_1 = require("./gamification/awardXP");
Object.defineProperty(exports, "awardXP", { enumerable: true, get: function () { return awardXP_1.awardXP; } });
// Import AI functions
var analyzeSpendingPatterns_1 = require("./ai/analyzeSpendingPatterns");
Object.defineProperty(exports, "analyzeSpendingPatterns", { enumerable: true, get: function () { return analyzeSpendingPatterns_1.analyzeSpendingPatterns; } });
var generateStudentRecommendations_1 = require("./ai/generateStudentRecommendations");
Object.defineProperty(exports, "generateStudentRecommendations", { enumerable: true, get: function () { return generateStudentRecommendations_1.generateStudentRecommendations; } });
var detectSpendingAnomalies_1 = require("./ai/detectSpendingAnomalies");
Object.defineProperty(exports, "detectSpendingAnomalies", { enumerable: true, get: function () { return detectSpendingAnomalies_1.detectSpendingAnomalies; } });
var generateComparativeInsights_1 = require("./ai/generateComparativeInsights");
Object.defineProperty(exports, "generateComparativeInsights", { enumerable: true, get: function () { return generateComparativeInsights_1.generateComparativeInsights; } });
var calculatePeerAverages_1 = require("./ai/calculatePeerAverages");
Object.defineProperty(exports, "calculatePeerAverages", { enumerable: true, get: function () { return calculatePeerAverages_1.calculatePeerAverages; } });
Object.defineProperty(exports, "triggerPeerAveragesCalculation", { enumerable: true, get: function () { return calculatePeerAverages_1.triggerPeerAveragesCalculation; } });
var peerDataAggregation_1 = require("./ai/peerDataAggregation");
Object.defineProperty(exports, "aggregatePeerData", { enumerable: true, get: function () { return peerDataAggregation_1.aggregatePeerData; } });
Object.defineProperty(exports, "triggerPeerDataAggregation", { enumerable: true, get: function () { return peerDataAggregation_1.triggerPeerDataAggregation; } });
var explainAnomaly_1 = require("./ai/explainAnomaly");
Object.defineProperty(exports, "explainAnomaly", { enumerable: true, get: function () { return explainAnomaly_1.explainAnomaly; } });
var testGemini_1 = require("./ai/testGemini");
Object.defineProperty(exports, "testGeminiAI", { enumerable: true, get: function () { return testGemini_1.testGeminiAI; } });
// Import premium functions
var verifySubscription_1 = require("./premium/verifySubscription");
Object.defineProperty(exports, "verifySubscription", { enumerable: true, get: function () { return verifySubscription_1.verifySubscription; } });
var manageSubscription_1 = require("./premium/manageSubscription");
Object.defineProperty(exports, "manageSubscription", { enumerable: true, get: function () { return manageSubscription_1.manageSubscription; } });
var enforceTrackerLimits_1 = require("./premium/enforceTrackerLimits");
Object.defineProperty(exports, "enforceTrackerLimits", { enumerable: true, get: function () { return enforceTrackerLimits_1.enforceTrackerLimits; } });
var generateDataExport_1 = require("./premium/generateDataExport");
Object.defineProperty(exports, "generateDataExport", { enumerable: true, get: function () { return generateDataExport_1.generateDataExport; } });
var processPayment_1 = require("./premium/processPayment");
Object.defineProperty(exports, "processPayment", { enumerable: true, get: function () { return processPayment_1.processPayment; } });
Object.defineProperty(exports, "paystackWebhook", { enumerable: true, get: function () { return processPayment_1.paystackWebhook; } });
Object.defineProperty(exports, "verifyPayment", { enumerable: true, get: function () { return processPayment_1.verifyPayment; } });
var trialManagement_1 = require("./premium/trialManagement");
Object.defineProperty(exports, "startFreeTrial", { enumerable: true, get: function () { return trialManagement_1.startFreeTrial; } });
Object.defineProperty(exports, "cancelTrialOnUpgrade", { enumerable: true, get: function () { return trialManagement_1.cancelTrialOnUpgrade; } });
Object.defineProperty(exports, "scheduleTrialReminder", { enumerable: true, get: function () { return trialManagement_1.scheduleTrialReminder; } });
Object.defineProperty(exports, "upgradeFromTrial", { enumerable: true, get: function () { return trialManagement_1.upgradeFromTrial; } });
Object.defineProperty(exports, "checkTrialExpiration", { enumerable: true, get: function () { return trialManagement_1.checkTrialExpiration; } });
// Import notification functions
var sendNotification_1 = require("./notifications/sendNotification");
Object.defineProperty(exports, "sendNotification", { enumerable: true, get: function () { return sendNotification_1.sendNotification; } });
Object.defineProperty(exports, "sendStreakReminders", { enumerable: true, get: function () { return sendNotification_1.sendStreakReminders; } });
Object.defineProperty(exports, "sendStreakRiskReminders", { enumerable: true, get: function () { return sendNotification_1.sendStreakRiskReminders; } });
Object.defineProperty(exports, "cleanupOldNotifications", { enumerable: true, get: function () { return sendNotification_1.cleanupOldNotifications; } });
var budgetAlertTrigger_1 = require("./notifications/budgetAlertTrigger");
Object.defineProperty(exports, "checkBudgetOnTransaction", { enumerable: true, get: function () { return budgetAlertTrigger_1.checkBudgetOnTransaction; } });
// ML anomaly detection — Isolation Forest implemented natively in TypeScript
var isolationForestAnomalyDetection_1 = require("./ml/isolationForestAnomalyDetection");
Object.defineProperty(exports, "trainIsolationForestModel", { enumerable: true, get: function () { return isolationForestAnomalyDetection_1.trainIsolationForestModel; } });
Object.defineProperty(exports, "detectAnomalyWithIsolationForest", { enumerable: true, get: function () { return isolationForestAnomalyDetection_1.detectAnomalyWithIsolationForest; } });
Object.defineProperty(exports, "getModelStatus", { enumerable: true, get: function () { return isolationForestAnomalyDetection_1.getModelStatus; } });
// Admin utilities (one-time ops)
var seedAchievements_1 = require("./admin/seedAchievements");
Object.defineProperty(exports, "seedAchievements", { enumerable: true, get: function () { return seedAchievements_1.seedAchievements; } });
//# sourceMappingURL=index.js.map