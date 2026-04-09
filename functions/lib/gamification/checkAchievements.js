"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAchievements = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const checkAchievements = async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (context.auth.uid !== data.userId) {
        throw new functions.https.HttpsError('permission-denied', 'User can only check their own achievements');
    }
    const db = admin.firestore();
    const batch = db.batch();
    const unlockedAchievements = [];
    try {
        // Get user data
        const userDoc = await db.collection('users').doc(data.userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        // Get all achievements
        const achievementsSnapshot = await db.collection('global').doc('achievements').get();
        if (!achievementsSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Achievements not found');
        }
        const allAchievements = achievementsSnapshot.data().achievements;
        // Get user's current achievements
        const userAchievementsSnapshot = await db.collection('users').doc(data.userId)
            .collection('achievements').get();
        const unlockedAchievementIds = new Set(userAchievementsSnapshot.docs
            .filter(doc => doc.data().unlocked)
            .map(doc => doc.id));
        // Check each achievement
        for (const achievement of allAchievements) {
            if (unlockedAchievementIds.has(achievement.achievementId)) {
                continue; // Already unlocked
            }
            const shouldUnlock = await checkAchievementCondition(achievement, userData, data.context, db, data.userId);
            if (shouldUnlock) {
                // Unlock achievement
                const achievementRef = db.collection('users').doc(data.userId)
                    .collection('achievements').doc(achievement.achievementId);
                batch.set(achievementRef, {
                    achievementId: achievement.achievementId,
                    userId: data.userId,
                    unlocked: true,
                    unlockedDate: admin.firestore.FieldValue.serverTimestamp(),
                    xpAwarded: achievement.xpReward
                });
                // Award XP
                const userRef = db.collection('users').doc(data.userId);
                batch.update(userRef, {
                    xp: admin.firestore.FieldValue.increment(achievement.xpReward),
                    level: Math.floor((userData.xp + achievement.xpReward) / 100) + 1
                });
                unlockedAchievements.push(achievement);
            }
        }
        // Commit all changes
        await batch.commit();
        return {
            success: true,
            unlockedAchievements: unlockedAchievements.map(a => ({
                achievementId: a.achievementId,
                title: a.title,
                description: a.description,
                icon: a.icon,
                xpReward: a.xpReward,
                rarity: a.rarity
            }))
        };
    }
    catch (error) {
        console.error('Error checking achievements:', error);
        throw new functions.https.HttpsError('internal', 'Failed to check achievements');
    }
};
exports.checkAchievements = checkAchievements;
async function checkAchievementCondition(achievement, userData, context, db, userId) {
    const conditions = achievement.unlockConditions;
    switch (achievement.category) {
        case 'Transaction':
            return await checkTransactionAchievement(conditions, userData, context, db, userId);
        case 'Budget':
            return await checkBudgetAchievement(conditions, userData, context, db, userId);
        case 'Savings':
            return await checkSavingsAchievement(conditions, userData, context, db, userId);
        case 'Streak':
            return checkStreakAchievement(conditions, userData);
        case 'Category Master':
            return await checkCategoryAchievement(conditions, userData, context, db, userId);
        case 'Special':
            return checkSpecialAchievement(conditions, userData, context);
        case 'Meta':
            return await checkMetaAchievement(conditions, userData, context, db, userId);
        default:
            return false;
    }
}
async function checkTransactionAchievement(conditions, userData, context, db, userId) {
    if (conditions.type === 'first_transaction') {
        return context.type === 'transaction';
    }
    if (conditions.type === 'transaction_count') {
        const transactionsSnapshot = await db.collection('users').doc(userId)
            .collection('transactions').get();
        return transactionsSnapshot.size >= conditions.count;
    }
    if (conditions.type === 'daily_transactions') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const transactionsSnapshot = await db.collection('users').doc(userId)
            .collection('transactions')
            .where('createdAt', '>=', today)
            .get();
        return transactionsSnapshot.size >= conditions.count;
    }
    return false;
}
async function checkBudgetAchievement(conditions, userData, context, db, userId) {
    if (conditions.type === 'first_budget') {
        return context.type === 'budget';
    }
    if (conditions.type === 'budget_count') {
        const budgetsSnapshot = await db.collection('users').doc(userId)
            .collection('budgets').get();
        return budgetsSnapshot.size >= conditions.count;
    }
    if (conditions.type === 'under_budget') {
        // Check if user stayed under budget for specified period
        const budgetsSnapshot = await db.collection('users').doc(userId)
            .collection('budgets').get();
        let underBudgetCount = 0;
        for (const budgetDoc of budgetsSnapshot.docs) {
            const budget = budgetDoc.data();
            // Calculate spending for this budget's category and period
            const spending = await calculateBudgetSpending(db, userId, budget);
            if (spending <= budget.limit) {
                underBudgetCount++;
            }
        }
        return underBudgetCount >= conditions.count;
    }
    return false;
}
async function checkSavingsAchievement(conditions, userData, context, db, userId) {
    if (conditions.type === 'first_goal') {
        return context.type === 'savings';
    }
    if (conditions.type === 'goal_completed') {
        const goalsSnapshot = await db.collection('users').doc(userId)
            .collection('savings_goals')
            .where('isCompleted', '==', true)
            .get();
        return goalsSnapshot.size >= conditions.count;
    }
    if (conditions.type === 'savings_amount') {
        const goalsSnapshot = await db.collection('users').doc(userId)
            .collection('savings_goals').get();
        let totalSaved = 0;
        goalsSnapshot.docs.forEach(doc => {
            totalSaved += doc.data().currentAmount || 0;
        });
        return totalSaved >= conditions.amount;
    }
    return false;
}
function checkStreakAchievement(conditions, userData) {
    if (conditions.type === 'streak_milestone') {
        return userData.streak >= conditions.days;
    }
    return false;
}
async function checkCategoryAchievement(conditions, userData, context, db, userId) {
    if (conditions.type === 'category_usage') {
        const transactionsSnapshot = await db.collection('users').doc(userId)
            .collection('transactions')
            .where('category', '==', conditions.category)
            .get();
        return transactionsSnapshot.size >= conditions.count;
    }
    return false;
}
function checkSpecialAchievement(conditions, userData, context) {
    var _a;
    if (conditions.type === 'premium_upgrade') {
        return userData.isPremium === true;
    }
    if (conditions.type === 'business_mode') {
        return context.type === 'business' && ((_a = context.data) === null || _a === void 0 ? void 0 : _a.enabled) === true;
    }
    return false;
}
async function checkMetaAchievement(conditions, userData, context, db, userId) {
    if (conditions.type === 'achievement_count') {
        const achievementsSnapshot = await db.collection('users').doc(userId)
            .collection('achievements')
            .where('unlocked', '==', true)
            .get();
        return achievementsSnapshot.size >= conditions.count;
    }
    if (conditions.type === 'perfect_week') {
        // Check if user logged transactions every day for a week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const transactionsSnapshot = await db.collection('users').doc(userId)
            .collection('transactions')
            .where('createdAt', '>=', weekAgo)
            .get();
        const dailyTransactions = new Set();
        transactionsSnapshot.docs.forEach(doc => {
            const date = doc.data().createdAt.toDate();
            const dayKey = date.toDateString();
            dailyTransactions.add(dayKey);
        });
        return dailyTransactions.size >= 7;
    }
    return false;
}
async function calculateBudgetSpending(db, userId, budget) {
    const now = new Date();
    let startDate;
    if (budget.period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    else if (budget.period === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
    }
    else {
        // semester - assume 4 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 4);
    }
    const transactionsSnapshot = await db.collection('users').doc(userId)
        .collection('transactions')
        .where('category', '==', budget.category)
        .where('type', '==', 'expense')
        .where('createdAt', '>=', startDate)
        .get();
    let totalSpending = 0;
    transactionsSnapshot.docs.forEach(doc => {
        totalSpending += doc.data().amount;
    });
    return totalSpending;
}
//# sourceMappingURL=checkAchievements.js.map