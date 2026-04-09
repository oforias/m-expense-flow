"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateComparativeInsights = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
exports.generateComparativeInsights = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, period = 'monthly' } = data;
    // Verify user can only get their own insights
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot generate insights for other users');
    }
    try {
        const db = admin.firestore();
        // Check if user is Premium
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User profile not found');
        }
        const userProfile = userDoc.data();
        if (!userProfile.isPremium) {
            throw new functions.https.HttpsError('permission-denied', 'Premium subscription required for comparative insights');
        }
        // Calculate date range
        const now = new Date();
        const periodDays = getPeriodDays(period);
        const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
        // Get user's spending data
        const userTransactionsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .where('date', '>=', startDate)
            .where('type', '==', 'expense')
            .get();
        if (userTransactionsSnapshot.empty) {
            return {
                insights: [],
                message: 'Not enough spending data for comparison',
                period
            };
        }
        // Calculate user's spending by category
        const userCategoryTotals = new Map();
        let userTotalSpent = 0;
        userTransactionsSnapshot.docs.forEach(doc => {
            const transaction = doc.data();
            const category = transaction.category;
            const amount = transaction.amount;
            userTotalSpent += amount;
            userCategoryTotals.set(category, (userCategoryTotals.get(category) || 0) + amount);
        });
        // Get peer averages from global collection
        const peerAveragesSnapshot = await db
            .collection('global')
            .doc('peer_averages')
            .collection(period)
            .get();
        if (peerAveragesSnapshot.empty) {
            // If no peer data exists, calculate it from all users (this would typically be done by a scheduled function)
            await calculatePeerAverages(db, period);
            // Retry getting peer averages
            const retrySnapshot = await db
                .collection('global')
                .doc('peer_averages')
                .collection(period)
                .get();
            if (retrySnapshot.empty) {
                return {
                    insights: [],
                    message: 'Peer comparison data not available yet. Please try again later.',
                    period
                };
            }
        }
        // Convert peer data
        const peerData = new Map();
        peerAveragesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            peerData.set(data.category, data);
        });
        // Generate comparative insights
        const insights = generateComparativeAnalysis(userCategoryTotals, userTotalSpent, peerData);
        // Save insights to Firestore
        const batch = db.batch();
        insights.forEach(insight => {
            const docRef = db.collection('users').doc(userId).collection('comparative_insights').doc();
            batch.set(docRef, Object.assign(Object.assign({}, insight), { generatedAt: admin.firestore.FieldValue.serverTimestamp(), period, isRead: false }));
        });
        await batch.commit();
        return {
            insights,
            period,
            generatedAt: new Date().toISOString(),
            totalCategories: insights.length
        };
    }
    catch (error) {
        console.error('Error generating comparative insights:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate comparative insights');
    }
});
function getPeriodDays(period) {
    switch (period) {
        case 'weekly': return 7;
        case 'semester': return 120;
        default: return 30; // monthly
    }
}
function generateComparativeAnalysis(userCategoryTotals, userTotalSpent, peerData) {
    const insights = [];
    // Analyze each category where user has spending
    userCategoryTotals.forEach((userAmount, category) => {
        const peerInfo = peerData.get(category);
        if (!peerInfo || peerInfo.sampleSize < 10)
            return; // Need sufficient peer data
        const userPercentage = (userAmount / userTotalSpent) * 100;
        const peerAverage = peerInfo.averagePercentage;
        const difference = userPercentage - peerAverage;
        let status;
        let priority;
        if (Math.abs(difference) < 2) {
            status = 'average';
            priority = 'low';
        }
        else if (difference > 0) {
            status = 'above_average';
            priority = difference > 10 ? 'high' : 'medium';
        }
        else {
            status = 'below_average';
            priority = Math.abs(difference) > 10 ? 'medium' : 'low';
        }
        const insight = {
            category,
            userPercentage,
            peerAverage,
            difference,
            status,
            message: generateComparisonMessage(category, userPercentage, peerAverage, status),
            suggestions: generateComparisonSuggestions(category, status, Math.abs(difference)),
            priority
        };
        insights.push(insight);
    });
    // Check for categories where user spends nothing but peers do
    peerData.forEach((peerInfo, category) => {
        if (!userCategoryTotals.has(category) && peerInfo.averagePercentage > 5) {
            insights.push({
                category,
                userPercentage: 0,
                peerAverage: peerInfo.averagePercentage,
                difference: -peerInfo.averagePercentage,
                status: 'below_average',
                message: `You don't spend on ${category}, while other students spend ${peerInfo.averagePercentage.toFixed(1)}% of their budget here.`,
                suggestions: [`This might be good financial discipline, or you might be missing out on something important in this category.`],
                priority: peerInfo.averagePercentage > 10 ? 'medium' : 'low'
            });
        }
    });
    return insights.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}
function generateComparisonMessage(category, userPercentage, peerAverage, status) {
    const diff = Math.abs(userPercentage - peerAverage);
    switch (status) {
        case 'above_average':
            return `You spend ${userPercentage.toFixed(1)}% on ${category} vs ${peerAverage.toFixed(1)}% average among students. That's ${diff.toFixed(1)}% more than your peers.`;
        case 'below_average':
            return `You spend ${userPercentage.toFixed(1)}% on ${category} vs ${peerAverage.toFixed(1)}% average among students. That's ${diff.toFixed(1)}% less than your peers.`;
        default: // average
            return `Your ${category} spending (${userPercentage.toFixed(1)}%) is right in line with other students (${peerAverage.toFixed(1)}% average).`;
    }
}
function generateComparisonSuggestions(category, status, difference) {
    if (status === 'average') {
        return [`Your ${category} spending is well-balanced compared to peers.`];
    }
    const ghanaSpecificSuggestions = {
        'Uber/Bolt': {
            above: [
                'You\'re spending more on ride-hailing than most students. Try mixing in trotro rides for regular routes.',
                'Consider walking or cycling for short distances to reduce transport costs.',
                'Plan your trips better to avoid multiple short rides.'
            ],
            below: [
                'You\'re spending less on ride-hailing than most students - great job saving!',
                'If you\'re using trotro more, that\'s smart budgeting.',
                'Just ensure you\'re not compromising safety for savings, especially at night.'
            ]
        },
        'Restaurant/Café': {
            above: [
                'You\'re eating out more than most students. Try cooking with friends to save money.',
                'Pack lunch more often - it can save you significant money over a semester.',
                'Look for student discounts at local eateries.'
            ],
            below: [
                'You\'re spending less on eating out than most students - excellent self-control!',
                'If you\'re cooking more, that\'s great for both your wallet and health.',
                'Just make sure you\'re still enjoying social meals with friends occasionally.'
            ]
        },
        'Data Bundles': {
            above: [
                'You\'re spending more on data than most students. Try midnight bundles for cheaper rates.',
                'Use campus WiFi more often to reduce data usage.',
                'Consider unlimited plans if you\'re a very heavy user.'
            ],
            below: [
                'You\'re spending less on data than most students - smart usage!',
                'You\'re probably making good use of free WiFi.',
                'Keep monitoring to ensure you have enough data for your needs.'
            ]
        },
        'Parties & Clubs': {
            above: [
                'You\'re spending more on entertainment than most students. Set a weekly limit.',
                'Pre-drink responsibly to reduce club expenses.',
                'Look for student night discounts and free events.'
            ],
            below: [
                'You\'re spending less on entertainment than most students.',
                'This could be great budgeting or you might be missing out on social experiences.',
                'Balance is key - budget for some fun activities too!'
            ]
        },
        'Academic Materials': {
            above: [
                'You\'re spending more on academic materials than most students.',
                'Try sharing textbook costs with classmates.',
                'Use the library more and buy second-hand books when possible.'
            ],
            below: [
                'You\'re spending less on academic materials than most students.',
                'Make sure you have all the resources you need for your studies.',
                'Consider if you\'re missing important textbooks or materials.'
            ]
        }
    };
    const suggestions = ghanaSpecificSuggestions[category];
    if (suggestions) {
        return status === 'above_average' ? suggestions.above : suggestions.below;
    }
    // Generic suggestions
    if (status === 'above_average') {
        return [
            `Consider if your ${category} spending aligns with your financial priorities.`,
            `Look for ways to optimize your ${category} expenses.`,
            `Set a budget limit for ${category} to control spending.`
        ];
    }
    else {
        return [
            `Your lower ${category} spending shows good financial discipline.`,
            `Make sure you\'re not missing out on important things in this category.`,
            `Consider if there are beneficial expenses in ${category} you might be avoiding.`
        ];
    }
}
async function calculatePeerAverages(db, period) {
    // This function would typically be run as a scheduled Cloud Function
    // For now, we'll create some sample data
    const periodDays = getPeriodDays(period);
    const now = new Date();
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    // Get all users' spending data (in production, this would be paginated)
    const usersSnapshot = await db.collection('users').limit(100).get();
    const categoryTotals = new Map();
    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        // Get user's transactions for the period
        const transactionsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('transactions')
            .where('date', '>=', startDate)
            .where('type', '==', 'expense')
            .get();
        if (transactionsSnapshot.empty)
            continue;
        const userCategoryTotals = new Map();
        let userTotalSpent = 0;
        transactionsSnapshot.docs.forEach(doc => {
            const transaction = doc.data();
            const category = transaction.category;
            const amount = transaction.amount;
            userTotalSpent += amount;
            userCategoryTotals.set(category, (userCategoryTotals.get(category) || 0) + amount);
        });
        // Calculate percentages for this user
        userCategoryTotals.forEach((amount, category) => {
            const percentage = (amount / userTotalSpent) * 100;
            if (!categoryTotals.has(category)) {
                categoryTotals.set(category, { totalAmount: 0, userCount: 0, percentages: [] });
            }
            const categoryData = categoryTotals.get(category);
            categoryData.totalAmount += amount;
            categoryData.userCount += 1;
            categoryData.percentages.push(percentage);
        });
    }
    // Calculate averages and save to Firestore
    const batch = db.batch();
    categoryTotals.forEach((data, category) => {
        if (data.userCount < 5)
            return; // Need at least 5 users for meaningful average
        const averagePercentage = data.percentages.reduce((sum, p) => sum + p, 0) / data.percentages.length;
        const medianAmount = calculateMedian(data.percentages);
        const docRef = db.collection('global').doc('peer_averages').collection(period).doc(category);
        batch.set(docRef, {
            category,
            averagePercentage,
            medianAmount,
            sampleSize: data.userCount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await batch.commit();
}
function calculateMedian(numbers) {
    const sorted = numbers.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    else {
        return sorted[middle];
    }
}
//# sourceMappingURL=generateComparativeInsights.js.map