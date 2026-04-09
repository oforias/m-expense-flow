"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudentRecommendations = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const geminiClient_1 = require("./geminiClient");
const geminiConfig_1 = require("./geminiConfig");
exports.generateStudentRecommendations = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, period = 'monthly' } = data;
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot generate recommendations for other users');
    }
    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User profile not found');
        }
        const userProfile = userDoc.data();
        const now = new Date();
        let startDate;
        switch (period) {
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'semester':
                startDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        const [transactionsSnapshot, budgetsSnapshot, goalsSnapshot] = await Promise.all([
            db.collection('users').doc(userId).collection('transactions')
                .where('date', '>=', startDate)
                .where('type', '==', 'expense')
                .get(),
            db.collection('users').doc(userId).collection('budgets')
                .where('isActive', '==', true).get(),
            db.collection('users').doc(userId).collection('savings_goals')
                .where('isCompleted', '==', false).get(),
        ]);
        // Build category totals
        const categoryTotals = new Map();
        let totalSpent = 0;
        transactionsSnapshot.docs.forEach(doc => {
            const t = doc.data();
            totalSpent += t.amount;
            const existing = categoryTotals.get(t.category) || { amount: 0, count: 0 };
            categoryTotals.set(t.category, { amount: existing.amount + t.amount, count: existing.count + 1 });
        });
        const budgets = budgetsSnapshot.docs.map(doc => {
            const b = doc.data();
            return { category: b.category, limit: b.amount, spent: b.spent || 0 };
        });
        const goals = goalsSnapshot.docs.map(doc => {
            const g = doc.data();
            return { name: g.name, target: g.targetAmount, current: g.currentAmount || 0, deadline: g.deadline };
        });
        const spendingData = Array.from(categoryTotals.entries()).map(([category, d]) => ({
            category,
            amount: d.amount,
            count: d.count,
            percentage: totalSpent > 0 ? (d.amount / totalSpent) * 100 : 0,
        })).sort((a, b) => b.amount - a.amount);
        const monthlyIncome = userProfile.weeklyIncome ? userProfile.weeklyIncome * 4.33 : undefined;
        let recommendations;
        if ((0, geminiConfig_1.isGeminiEnabled)() && spendingData.length > 0) {
            try {
                recommendations = await generateGeminiRecommendations({
                    spendingData,
                    totalSpent,
                    budgets,
                    goals,
                    monthlyIncome,
                    period,
                    userLevel: userProfile.level || 1,
                    isPremium: userProfile.isPremium || false,
                });
            }
            catch (err) {
                console.warn('Gemini recommendations failed, falling back to rule-based:', err);
                recommendations = generateRuleBasedRecommendations(spendingData, totalSpent, budgets, goals, period);
            }
        }
        else {
            recommendations = generateRuleBasedRecommendations(spendingData, totalSpent, budgets, goals, period);
        }
        // Persist to Firestore
        const batch = db.batch();
        recommendations.forEach(rec => {
            const ref = db.collection('users').doc(userId).collection('ai_insights').doc();
            batch.set(ref, Object.assign(Object.assign({}, rec), { generatedAt: admin.firestore.FieldValue.serverTimestamp(), isRead: false }));
        });
        await batch.commit();
        return { recommendations, totalSpent, period, generatedAt: new Date().toISOString() };
    }
    catch (error) {
        console.error('Error generating student recommendations:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate recommendations');
    }
});
/**
 * Use Gemini to generate structured, personalised recommendations.
 * We ask Gemini to return JSON so we can parse it reliably.
 */
async function generateGeminiRecommendations(params) {
    const geminiClient = (0, geminiClient_1.getGeminiClient)();
    const systemContext = `You are a financial advisor for university students in Ghana. ` +
        `You give honest, specific, actionable advice. ` +
        `You know Ghana-specific context: trotro vs Uber/Bolt, midnight data bundles, ` +
        `situationship spending, campus food vs cooking, etc. ` +
        `Be direct and friendly. Use GHS for currency.`;
    const budgetLines = params.budgets.length > 0
        ? params.budgets.map(b => `  - ${b.category}: spent GHS ${b.spent.toFixed(2)} of GHS ${b.limit.toFixed(2)} limit (${((b.spent / b.limit) * 100).toFixed(0)}%)`).join('\n')
        : '  None set';
    const goalLines = params.goals.length > 0
        ? params.goals.map(g => `  - ${g.name}: GHS ${g.current.toFixed(2)} / GHS ${g.target.toFixed(2)} saved`).join('\n')
        : '  None set';
    const spendingLines = params.spendingData
        .map(s => `  - ${s.category}: GHS ${s.amount.toFixed(2)} (${s.percentage.toFixed(1)}%, ${s.count} transactions)`)
        .join('\n');
    const prompt = `Student financial data for the ${params.period}:\n\n` +
        `Monthly income: ${params.monthlyIncome ? `GHS ${params.monthlyIncome.toFixed(2)}` : 'unknown'}\n` +
        `Total spent: GHS ${params.totalSpent.toFixed(2)}\n\n` +
        `Spending breakdown:\n${spendingLines}\n\n` +
        `Active budgets:\n${budgetLines}\n\n` +
        `Savings goals:\n${goalLines}\n\n` +
        `Generate 5-7 personalised recommendations based on THIS specific data. ` +
        `Each recommendation must reference actual numbers from the data above. ` +
        `Do NOT give generic advice like "save more money". ` +
        `Return ONLY a JSON array with this exact structure, no markdown, no extra text:\n` +
        `[\n` +
        `  {\n` +
        `    "title": "short title",\n` +
        `    "message": "specific advice referencing actual amounts",\n` +
        `    "type": "tip|warning|success|info",\n` +
        `    "category": "category name or general",\n` +
        `    "priority": "high|medium|low",\n` +
        `    "actionable": true|false,\n` +
        `    "ghanaSpecific": true|false\n` +
        `  }\n` +
        `]`;
    const raw = await geminiClient.generateContent(prompt, systemContext);
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch (_a) {
        // If JSON parse fails, extract JSON array from the response
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match)
            throw new Error('Gemini did not return valid JSON');
        parsed = JSON.parse(match[0]);
    }
    return parsed.map((r) => ({
        title: r.title || 'Financial Insight',
        message: r.message || '',
        type: ['tip', 'warning', 'success', 'info'].includes(r.type) ? r.type : 'info',
        category: r.category || 'general',
        priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
        actionable: r.actionable !== false,
        ghanaSpecific: r.ghanaSpecific === true,
        isAIPowered: true,
    }));
}
/**
 * Rule-based fallback — only used when Gemini is unavailable.
 */
function generateRuleBasedRecommendations(spendingData, totalSpent, budgets, goals, period) {
    const recommendations = [];
    // Overspent budgets
    budgets.forEach(b => {
        if (b.spent > b.limit) {
            recommendations.push({
                title: `${b.category} Budget Exceeded`,
                message: `You've spent GHS ${b.spent.toFixed(2)} against a GHS ${b.limit.toFixed(2)} budget — GHS ${(b.spent - b.limit).toFixed(2)} over. Review this category.`,
                type: 'warning', category: b.category, priority: 'high', actionable: true, ghanaSpecific: false, isAIPowered: false,
            });
        }
    });
    // High spending categories
    spendingData.filter(s => s.percentage > 30).forEach(s => {
        recommendations.push({
            title: `High ${s.category} Spending`,
            message: `${s.category} is ${s.percentage.toFixed(1)}% of your total spend (GHS ${s.amount.toFixed(2)}). Consider setting a budget for this category.`,
            type: 'warning', category: s.category, priority: 'high', actionable: true, ghanaSpecific: false, isAIPowered: false,
        });
    });
    // Transport: Uber vs trotro
    const uber = spendingData.find(s => s.category === 'Uber/Bolt');
    const trotro = spendingData.find(s => s.category === 'Trotro & Transport');
    if (uber && trotro && uber.amount > trotro.amount * 2) {
        recommendations.push({
            title: 'Switch to Trotro for Regular Routes',
            message: `You spent GHS ${uber.amount.toFixed(2)} on Uber/Bolt vs GHS ${trotro.amount.toFixed(2)} on trotro. Using trotro for daily routes could save you up to GHS ${(uber.amount * 0.6).toFixed(2)}.`,
            type: 'tip', category: 'Transport', priority: 'high', actionable: true, ghanaSpecific: true, isAIPowered: false,
        });
    }
    // No goals set
    if (goals.length === 0) {
        recommendations.push({
            title: 'Set a Savings Goal',
            message: 'You have no active savings goals. Even a small goal like an emergency fund gives your saving a purpose.',
            type: 'tip', category: 'savings', priority: 'medium', actionable: true, ghanaSpecific: false, isAIPowered: false,
        });
    }
    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Keep Tracking!',
            message: `You've logged GHS ${totalSpent.toFixed(2)} in spending this ${period}. Keep it up — consistent tracking is the foundation of good financial health.`,
            type: 'success', category: 'general', priority: 'low', actionable: false, ghanaSpecific: false, isAIPowered: false,
        });
    }
    return recommendations.slice(0, 10);
}
//# sourceMappingURL=generateStudentRecommendations.js.map