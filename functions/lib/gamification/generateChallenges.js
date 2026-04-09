"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateChallengeProgress = exports.generateChallenges = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const generateChallenges = async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (context.auth.uid !== data.userId) {
        throw new functions.https.HttpsError('permission-denied', 'User can only generate their own challenges');
    }
    const db = admin.firestore();
    const batch = db.batch();
    try {
        // Get user data to personalize challenges
        const userDoc = await db.collection('users').doc(data.userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const userLevel = userData.level || 1;
        // Clear existing challenges for this period
        const existingChallenges = await db.collection('users').doc(data.userId)
            .collection('challenges')
            .where('period', '==', data.period)
            .where('completed', '==', false)
            .get();
        existingChallenges.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        // Generate new challenges based on period
        const challenges = generateChallengesByPeriod(data.period, userLevel, userData);
        // Add challenges to Firestore
        challenges.forEach(challenge => {
            const challengeRef = db.collection('users').doc(data.userId)
                .collection('challenges').doc();
            batch.set(challengeRef, Object.assign(Object.assign({}, challenge), { challengeId: challengeRef.id, userId: data.userId, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
        });
        await batch.commit();
        return {
            success: true,
            challenges: challenges.map(c => ({
                title: c.title,
                description: c.description,
                period: c.period,
                xpReward: c.xpReward,
                target: c.target
            }))
        };
    }
    catch (error) {
        console.error('Error generating challenges:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate challenges');
    }
};
exports.generateChallenges = generateChallenges;
function generateChallengesByPeriod(period, userLevel, userData) {
    const now = new Date();
    let deadline;
    let challenges = [];
    // Set deadline based on period
    switch (period) {
        case 'daily':
            deadline = new Date(now);
            deadline.setHours(23, 59, 59, 999);
            challenges = generateDailyChallenges(userLevel, userData);
            break;
        case 'weekly':
            deadline = new Date(now);
            deadline.setDate(now.getDate() + (7 - now.getDay())); // Next Sunday
            deadline.setHours(23, 59, 59, 999);
            challenges = generateWeeklyChallenges(userLevel, userData);
            break;
        case 'monthly':
            deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
            deadline.setHours(23, 59, 59, 999);
            challenges = generateMonthlyChallenges(userLevel, userData);
            break;
    }
    return challenges.map(challenge => (Object.assign(Object.assign({}, challenge), { deadline, progress: 0, completed: false })));
}
function generateDailyChallenges(userLevel, userData) {
    const baseXP = 20;
    const levelMultiplier = Math.floor(userLevel / 5) + 1;
    const dailyChallenges = [
        {
            title: "Transaction Logger",
            description: "Log 3 transactions today",
            period: 'daily',
            xpReward: baseXP * levelMultiplier,
            target: 3
        },
        {
            title: "Budget Checker",
            description: "Check your budget progress",
            period: 'daily',
            xpReward: baseXP,
            target: 1
        },
        {
            title: "Category Master",
            description: "Use 3 different expense categories",
            period: 'daily',
            xpReward: baseXP * levelMultiplier,
            target: 3
        },
        {
            title: "Savings Contributor",
            description: "Add money to a savings goal",
            period: 'daily',
            xpReward: baseXP * 2,
            target: 1
        },
        {
            title: "Streak Keeper",
            description: "Maintain your daily streak",
            period: 'daily',
            xpReward: baseXP,
            target: 1
        }
    ];
    // Return 3 random challenges for variety
    const shuffled = dailyChallenges.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}
function generateWeeklyChallenges(userLevel, userData) {
    const baseXP = 50;
    const levelMultiplier = Math.floor(userLevel / 5) + 1;
    const weeklyChallenges = [
        {
            title: "Weekly Warrior",
            description: "Log transactions every day this week",
            period: 'weekly',
            xpReward: baseXP * 2 * levelMultiplier,
            target: 7
        },
        {
            title: "Budget Master",
            description: "Stay under budget in 3 categories",
            period: 'weekly',
            xpReward: baseXP * levelMultiplier,
            target: 3
        },
        {
            title: "Transaction Tracker",
            description: "Log 20 transactions this week",
            period: 'weekly',
            xpReward: baseXP * levelMultiplier,
            target: 20
        },
        {
            title: "Category Explorer",
            description: "Use 10 different categories",
            period: 'weekly',
            xpReward: baseXP * levelMultiplier,
            target: 10
        },
        {
            title: "Savings Champion",
            description: "Contribute to savings goals 5 times",
            period: 'weekly',
            xpReward: baseXP * 2,
            target: 5
        },
        {
            title: "Transport Optimizer",
            description: "Log 5 transport expenses (Uber/Trotro)",
            period: 'weekly',
            xpReward: baseXP,
            target: 5
        }
    ];
    // Return 4 random challenges
    const shuffled = weeklyChallenges.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
}
function generateMonthlyChallenges(userLevel, userData) {
    const baseXP = 100;
    const levelMultiplier = Math.floor(userLevel / 5) + 1;
    const monthlyChallenges = [
        {
            title: "Monthly Master",
            description: "Log transactions for 25 days this month",
            period: 'monthly',
            xpReward: baseXP * 3 * levelMultiplier,
            target: 25
        },
        {
            title: "Budget Perfectionist",
            description: "Stay under budget in all categories",
            period: 'monthly',
            xpReward: baseXP * 4,
            target: 1 // Will be checked against all active budgets
        },
        {
            title: "Transaction Century",
            description: "Log 100 transactions this month",
            period: 'monthly',
            xpReward: baseXP * 2 * levelMultiplier,
            target: 100
        },
        {
            title: "Savings Superstar",
            description: "Complete a savings goal",
            period: 'monthly',
            xpReward: baseXP * 3,
            target: 1
        },
        {
            title: "Category Completionist",
            description: "Use 20 different categories",
            period: 'monthly',
            xpReward: baseXP * 2,
            target: 20
        },
        {
            title: "Ghana Student Special",
            description: "Log expenses in all Ghana-specific categories",
            period: 'monthly',
            xpReward: baseXP * 2,
            target: 15 // Number of Ghana-specific categories
        }
    ];
    // Return 3 random challenges
    const shuffled = monthlyChallenges.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}
const updateChallengeProgress = async (userId, challengeType, increment = 1) => {
    const db = admin.firestore();
    try {
        // Get active challenges for this user
        const challengesSnapshot = await db.collection('users').doc(userId)
            .collection('challenges')
            .where('completed', '==', false)
            .get();
        const batch = db.batch();
        let completedChallenges = [];
        for (const challengeDoc of challengesSnapshot.docs) {
            const challenge = challengeDoc.data();
            // Check if this challenge should be updated based on the action type
            if (shouldUpdateChallenge(challenge, challengeType)) {
                const newProgress = challenge.progress + increment;
                const isCompleted = newProgress >= challenge.target;
                batch.update(challengeDoc.ref, Object.assign({ progress: newProgress, completed: isCompleted }, (isCompleted && { completedDate: admin.firestore.FieldValue.serverTimestamp() })));
                if (isCompleted) {
                    // Award XP for completed challenge
                    const userRef = db.collection('users').doc(userId);
                    batch.update(userRef, {
                        xp: admin.firestore.FieldValue.increment(challenge.xpReward)
                    });
                    completedChallenges.push({
                        title: challenge.title,
                        xpReward: challenge.xpReward
                    });
                }
            }
        }
        await batch.commit();
        return completedChallenges;
    }
    catch (error) {
        console.error('Error updating challenge progress:', error);
        return [];
    }
};
exports.updateChallengeProgress = updateChallengeProgress;
function shouldUpdateChallenge(challenge, actionType) {
    const challengeTitle = challenge.title.toLowerCase();
    switch (actionType) {
        case 'transaction_logged':
            return challengeTitle.includes('transaction') || challengeTitle.includes('logger') ||
                challengeTitle.includes('warrior') || challengeTitle.includes('tracker') ||
                challengeTitle.includes('century') || challengeTitle.includes('master');
        case 'budget_checked':
            return challengeTitle.includes('budget') && challengeTitle.includes('checker');
        case 'category_used':
            return challengeTitle.includes('category') || challengeTitle.includes('explorer') ||
                challengeTitle.includes('completionist');
        case 'savings_contributed':
            return challengeTitle.includes('savings') || challengeTitle.includes('contributor') ||
                challengeTitle.includes('champion');
        case 'streak_maintained':
            return challengeTitle.includes('streak');
        case 'transport_logged':
            return challengeTitle.includes('transport');
        case 'ghana_category_used':
            return challengeTitle.includes('ghana');
        case 'daily_active':
            return challengeTitle.includes('warrior') || challengeTitle.includes('master');
        default:
            return false;
    }
}
//# sourceMappingURL=generateChallenges.js.map