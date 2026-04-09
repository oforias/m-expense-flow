"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBudgetOnTransaction = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
/**
 * Firestore trigger: fires whenever a transaction is created or updated.
 * Recalculates budget progress for the transaction's category and sends
 * a push notification if the user has crossed 80% or 100% of their budget.
 *
 * This runs server-side so alerts fire even when the app is closed.
 */
exports.checkBudgetOnTransaction = functions.firestore
    .document('users/{userId}/transactions/{transactionId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c;
    const { userId } = context.params;
    // Only care about expense transactions
    const data = change.after.exists ? change.after.data() : null;
    if (!data || data.type !== 'expense')
        return;
    const category = data.category;
    const db = admin.firestore();
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Find the monthly budget for this category
    const budgetsSnap = await db
        .collection('users').doc(userId)
        .collection('budgets')
        .where('category', '==', category)
        .where('period', '==', 'monthly')
        .where('monthYear', '==', monthYear)
        .limit(1)
        .get();
    if (budgetsSnap.empty)
        return;
    const budgetDoc = budgetsSnap.docs[0];
    const budget = budgetDoc.data();
    const limit = budget.limit;
    const budgetId = budgetDoc.id;
    // Sum all expenses in this category for the current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const txSnap = await db
        .collection('users').doc(userId)
        .collection('transactions')
        .where('category', '==', category)
        .where('type', '==', 'expense')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(monthStart))
        .get();
    const totalSpent = txSnap.docs.reduce((sum, d) => sum + d.data().amount, 0);
    const percentage = (totalSpent / limit) * 100;
    // Determine new alert level
    const newLevel = percentage >= 100 ? 'alert' : percentage >= 80 ? 'warning' : 'normal';
    if (newLevel === 'normal')
        return;
    // Check last notified level to avoid duplicates
    const stateRef = db
        .collection('users').doc(userId)
        .collection('budget_alert_state').doc(budgetId);
    const stateDoc = await stateRef.get();
    const lastLevel = stateDoc.exists ? ((_b = (_a = stateDoc.data()) === null || _a === void 0 ? void 0 : _a.lastAlertLevel) !== null && _b !== void 0 ? _b : 'normal') : 'normal';
    const escalated = (newLevel === 'warning' && lastLevel === 'normal') ||
        (newLevel === 'alert' && lastLevel !== 'alert');
    if (!escalated)
        return;
    // Get user's FCM token
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmToken = (_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.fcmToken;
    if (!fcmToken)
        return;
    const categoryName = category.replace(/_/g, ' ');
    const title = newLevel === 'alert' ? '🚨 Budget Exceeded' : '⚠️ Budget Warning';
    const body = newLevel === 'alert'
        ? `You've exceeded your ${categoryName} budget! Spent GHS ${totalSpent.toFixed(2)} of GHS ${limit.toFixed(2)}`
        : `You've used ${percentage.toFixed(0)}% of your ${categoryName} budget (GHS ${totalSpent.toFixed(2)} / GHS ${limit.toFixed(2)})`;
    // Queue notification
    await db.collection('notifications').add({
        userId,
        fcmToken,
        title,
        body,
        type: 'budget_alert',
        data: {
            budgetId,
            category,
            spentAmount: totalSpent.toString(),
            budgetLimit: limit.toString(),
            percentage: percentage.toString(),
            alertType: newLevel,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
    });
    // Persist new alert level
    await stateRef.set({
        lastAlertLevel: newLevel,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Budget alert queued for user ${userId}: ${category} at ${percentage.toFixed(0)}%`);
});
//# sourceMappingURL=budgetAlertTrigger.js.map