"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBusinessInsights = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.generateBusinessInsights = functions.https.onCall(async (data, context) => {
    try {
        const { userId, period = 'monthly' } = data;
        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
        }
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (context.auth.uid !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'User can only access their own data');
        }
        const db = admin.firestore();
        // Check if user has premium access and business mode enabled
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        if (!(userData === null || userData === void 0 ? void 0 : userData.isPremium)) {
            throw new functions.https.HttpsError('permission-denied', 'Premium subscription required for business insights');
        }
        // Check if business profile exists
        const businessProfileDoc = await db
            .collection('users')
            .doc(userId)
            .collection('business_profile')
            .doc('profile')
            .get();
        if (!businessProfileDoc.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Business profile not found. Please set up business mode first.');
        }
        const businessProfile = businessProfileDoc.data();
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        switch (period) {
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarterly':
                const quarterStart = Math.floor(now.getMonth() / 3) * 3;
                startDate = new Date(now.getFullYear(), quarterStart, 1);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        // Fetch business transactions for the period
        const businessTransactionsQuery = await db
            .collection('users')
            .doc(userId)
            .collection('business_transactions')
            .where('date', '>=', startDate)
            .where('date', '<=', now)
            .get();
        const transactions = businessTransactionsQuery.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Calculate business metrics
        const metrics = calculateBusinessMetrics(transactions);
        // Generate insights based on metrics and Ghana-specific context
        const insights = generateInsightsFromMetrics(metrics, businessProfile, period);
        // Save insights to Firestore
        const insightPromises = insights.map(insight => db.collection('users')
            .doc(userId)
            .collection('ai_insights')
            .add(Object.assign(Object.assign({}, insight), { generatedAt: new Date(), isPremium: true, isRead: false, source: 'business_analysis' })));
        await Promise.all(insightPromises);
        functions.logger.info(`Generated ${insights.length} business insights for user ${userId}`);
        return {
            success: true,
            insights,
            metrics: {
                totalRevenue: metrics.totalRevenue,
                totalExpenses: metrics.totalExpenses,
                netProfit: metrics.netProfit,
                profitMargin: metrics.profitMargin,
                transactionCount: metrics.transactionCount
            },
            period,
            generatedAt: new Date().toISOString()
        };
    }
    catch (error) {
        functions.logger.error('Error generating business insights:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to generate business insights');
    }
});
function calculateBusinessMetrics(transactions) {
    const categoryBreakdown = {};
    let totalRevenue = 0;
    let totalExpenses = 0;
    let topRevenueCategory = '';
    let topExpenseCategory = '';
    let maxRevenue = 0;
    let maxExpenses = 0;
    // Process each transaction
    transactions.forEach(transaction => {
        const { type, amount, category } = transaction;
        if (!categoryBreakdown[category]) {
            categoryBreakdown[category] = { revenue: 0, expenses: 0 };
        }
        if (type === 'income') {
            totalRevenue += amount;
            categoryBreakdown[category].revenue += amount;
            if (categoryBreakdown[category].revenue > maxRevenue) {
                maxRevenue = categoryBreakdown[category].revenue;
                topRevenueCategory = category;
            }
        }
        else if (type === 'expense') {
            totalExpenses += amount;
            categoryBreakdown[category].expenses += amount;
            if (categoryBreakdown[category].expenses > maxExpenses) {
                maxExpenses = categoryBreakdown[category].expenses;
                topExpenseCategory = category;
            }
        }
    });
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const averageTransactionValue = transactions.length > 0 ? totalRevenue / transactions.length : 0;
    return {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        transactionCount: transactions.length,
        averageTransactionValue,
        topRevenueCategory,
        topExpenseCategory,
        categoryBreakdown
    };
}
function generateInsightsFromMetrics(metrics, businessProfile, period) {
    var _a, _b;
    const insights = [];
    const businessType = (businessProfile === null || businessProfile === void 0 ? void 0 : businessProfile.businessType) || 'general';
    // Profit Margin Analysis
    if (metrics.profitMargin < 10) {
        insights.push({
            type: 'warning',
            title: 'Low Profit Margin Alert',
            message: `Your profit margin is ${metrics.profitMargin.toFixed(1)}%, which is below the recommended 15-20% for student businesses in Ghana. Consider reviewing your pricing or reducing expenses.`,
            priority: 'high',
            actionable: true,
            ghanaSpecific: true
        });
    }
    else if (metrics.profitMargin > 30) {
        insights.push({
            type: 'profit',
            title: 'Excellent Profit Margin',
            message: `Outstanding! Your ${metrics.profitMargin.toFixed(1)}% profit margin is well above average for Ghanaian student businesses. Consider reinvesting or expanding your operations.`,
            priority: 'medium',
            actionable: true,
            ghanaSpecific: true
        });
    }
    // Revenue Growth Insights
    if (metrics.totalRevenue > 0) {
        insights.push({
            type: 'revenue',
            title: `${period.charAt(0).toUpperCase() + period.slice(1)} Revenue Summary`,
            message: `You generated GHS ${metrics.totalRevenue.toFixed(2)} in revenue this ${period}. Your top performing category is ${metrics.topRevenueCategory}.`,
            priority: 'medium',
            actionable: false,
            ghanaSpecific: true
        });
    }
    // Business Type Specific Insights
    switch (businessType) {
        case 'Fashion Reseller':
            if (((_a = metrics.categoryBreakdown['Inventory']) === null || _a === void 0 ? void 0 : _a.expenses) > metrics.totalRevenue * 0.6) {
                insights.push({
                    type: 'warning',
                    title: 'High Inventory Costs',
                    message: 'Your inventory costs are above 60% of revenue. Consider sourcing from cheaper suppliers or negotiating better wholesale prices in Accra or Kumasi markets.',
                    priority: 'high',
                    category: 'Inventory',
                    actionable: true,
                    ghanaSpecific: true
                });
            }
            break;
        case 'Food Vendor':
            insights.push({
                type: 'efficiency',
                title: 'Food Business Optimization',
                message: 'Consider bulk purchasing ingredients from Makola Market or Kejetia Market to reduce costs. Track which meals have the highest profit margins.',
                priority: 'medium',
                actionable: true,
                ghanaSpecific: true
            });
            break;
        case 'Digital Services':
            if (metrics.averageTransactionValue < 50) {
                insights.push({
                    type: 'growth',
                    title: 'Increase Service Value',
                    message: `Your average transaction value is GHS ${metrics.averageTransactionValue.toFixed(2)}. Consider offering premium packages or bundled services to increase revenue per client.`,
                    priority: 'medium',
                    actionable: true,
                    ghanaSpecific: false
                });
            }
            break;
        case 'Tutoring Services':
            insights.push({
                type: 'growth',
                title: 'Tutoring Business Growth',
                message: 'Consider offering group sessions or online tutoring to scale your business. WASSCE and university entrance exam prep are high-demand areas in Ghana.',
                priority: 'medium',
                actionable: true,
                ghanaSpecific: true
            });
            break;
    }
    // Expense Management Insights
    if (metrics.topExpenseCategory) {
        const topExpenseAmount = ((_b = metrics.categoryBreakdown[metrics.topExpenseCategory]) === null || _b === void 0 ? void 0 : _b.expenses) || 0;
        const expensePercentage = (topExpenseAmount / metrics.totalExpenses) * 100;
        if (expensePercentage > 40) {
            insights.push({
                type: 'expense',
                title: 'High Expense Category Alert',
                message: `${metrics.topExpenseCategory} accounts for ${expensePercentage.toFixed(1)}% of your expenses. Look for ways to optimize costs in this area.`,
                priority: 'medium',
                category: metrics.topExpenseCategory,
                actionable: true,
                ghanaSpecific: false
            });
        }
    }
    // Transaction Volume Insights
    if (metrics.transactionCount < 10) {
        insights.push({
            type: 'growth',
            title: 'Increase Transaction Volume',
            message: `You had ${metrics.transactionCount} transactions this ${period}. Focus on marketing and customer acquisition to grow your business. Consider social media promotion or word-of-mouth referrals.`,
            priority: 'medium',
            actionable: true,
            ghanaSpecific: true
        });
    }
    // Ghana-Specific Business Insights
    insights.push({
        type: 'efficiency',
        title: 'Mobile Money Integration',
        message: 'Consider accepting MTN MoMo and Vodafone Cash payments to make transactions easier for your customers. This can increase sales by 20-30% for student businesses.',
        priority: 'low',
        actionable: true,
        ghanaSpecific: true
    });
    // Seasonal Business Advice
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 8 && currentMonth <= 11) { // September to December
        insights.push({
            type: 'growth',
            title: 'End-of-Year Opportunities',
            message: 'This is peak season for student businesses in Ghana. Consider offering Christmas specials, semester-end services, or holiday promotions to maximize revenue.',
            priority: 'medium',
            actionable: true,
            ghanaSpecific: true
        });
    }
    return insights;
}
//# sourceMappingURL=generateBusinessInsights.js.map