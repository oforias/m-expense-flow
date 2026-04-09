import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Import already-wrapped Cloud Functions
export { generateBusinessInsights } from './business/generateBusinessInsights';
export { enableBusinessMode } from './business/enableBusinessMode';
export { applyBusinessTemplate } from './business/applyBusinessTemplate';
export { calculateProfitMargin } from './business/calculateProfitMargin';
export { resetLeaderboards, resetMonthlyLeaderboard } from './gamification/updateLeaderboard';
export { checkAchievements } from './gamification/checkAchievements';
export { updateLeaderboard } from './gamification/updateLeaderboard';
export { generateChallenges } from './gamification/generateChallenges';
export { awardXP } from './gamification/awardXP';

// Import AI functions
export { analyzeSpendingPatterns } from './ai/analyzeSpendingPatterns';
export { generateStudentRecommendations } from './ai/generateStudentRecommendations';
export { detectSpendingAnomalies } from './ai/detectSpendingAnomalies';
export { generateComparativeInsights } from './ai/generateComparativeInsights';
export { calculatePeerAverages, triggerPeerAveragesCalculation } from './ai/calculatePeerAverages';
export { aggregatePeerData, triggerPeerDataAggregation } from './ai/peerDataAggregation';
export { explainAnomaly } from './ai/explainAnomaly';
export { testGeminiAI } from './ai/testGemini';

// Import premium functions
export { verifySubscription } from './premium/verifySubscription';
export { manageSubscription } from './premium/manageSubscription';
export { enforceTrackerLimits } from './premium/enforceTrackerLimits';
export { generateDataExport } from './premium/generateDataExport';
export { processPayment, paystackWebhook, verifyPayment } from './premium/processPayment';
export { 
  startFreeTrial, 
  cancelTrialOnUpgrade, 
  scheduleTrialReminder, 
  upgradeFromTrial,
  checkTrialExpiration 
} from './premium/trialManagement';

// Import notification functions
export { sendNotification, sendStreakReminders, sendStreakRiskReminders, cleanupOldNotifications } from './notifications/sendNotification';
export { checkBudgetOnTransaction } from './notifications/budgetAlertTrigger';

// ML anomaly detection — Isolation Forest implemented natively in TypeScript
export { trainIsolationForestModel, detectAnomalyWithIsolationForest, getModelStatus } from './ml/isolationForestAnomalyDetection';

// Admin utilities (one-time ops)
export { seedAchievements } from './admin/seedAchievements';