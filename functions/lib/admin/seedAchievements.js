"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAchievements = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
/**
 * One-time HTTP function to seed all achievements into Firestore.
 * After deploy, call once:
 *   https://<region>-<project>.cloudfunctions.net/seedAchievements?key=expense_flow_seed_2026
 * Then you can delete this function or leave it (it's idempotent).
 */
exports.seedAchievements = functions.https.onRequest(async (req, res) => {
    const secret = 'expense_flow_seed_2026';
    if (req.query.key !== secret) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const db = admin.firestore();
    const achievements = getAllAchievements();
    await db.collection('global').doc('achievements').set({
        achievements,
        seededAt: admin.firestore.FieldValue.serverTimestamp(),
        count: achievements.length,
    });
    res.json({ success: true, message: `Seeded ${achievements.length} achievements` });
});
function a(id, title, desc, icon, cat, xp, rarity, cond) {
    return { achievementId: id, title, description: desc, icon, category: cat, xpReward: xp, rarity, unlockConditions: cond };
}
function getAllAchievements() {
    return [
        // Transaction (20)
        a('first_transaction', 'First Step', 'Log your first transaction', '🎯', 'Transaction', 25, 'common', { type: 'first_transaction' }),
        a('transaction_10', 'Getting Started', 'Log 10 transactions', '📝', 'Transaction', 50, 'common', { type: 'transaction_count', count: 10 }),
        a('transaction_50', 'Tracking Pro', 'Log 50 transactions', '📊', 'Transaction', 100, 'common', { type: 'transaction_count', count: 50 }),
        a('transaction_100', 'Century Club', 'Log 100 transactions', '💯', 'Transaction', 150, 'rare', { type: 'transaction_count', count: 100 }),
        a('transaction_250', 'Data Master', 'Log 250 transactions', '📈', 'Transaction', 200, 'rare', { type: 'transaction_count', count: 250 }),
        a('transaction_500', 'Financial Historian', 'Log 500 transactions', '📚', 'Transaction', 300, 'epic', { type: 'transaction_count', count: 500 }),
        a('transaction_1000', 'Legendary Tracker', 'Log 1000 transactions', '🏆', 'Transaction', 500, 'legendary', { type: 'transaction_count', count: 1000 }),
        a('daily_logger', 'Daily Logger', 'Log transactions for 7 consecutive days', '📅', 'Transaction', 75, 'common', { type: 'daily_transactions', count: 7 }),
        a('weekly_warrior', 'Weekly Warrior', 'Log transactions for 30 consecutive days', '⚔️', 'Transaction', 150, 'rare', { type: 'daily_transactions', count: 30 }),
        a('monthly_master_tx', 'Monthly Master', 'Log transactions for 90 consecutive days', '👑', 'Transaction', 250, 'epic', { type: 'daily_transactions', count: 90 }),
        a('big_spender', 'Big Spender', 'Log a single expense over GHS 500', '💸', 'Transaction', 50, 'common', { type: 'first_transaction' }),
        a('major_purchase', 'Major Purchase', 'Log a single expense over GHS 1000', '🛍️', 'Transaction', 100, 'rare', { type: 'first_transaction' }),
        a('income_earner', 'Income Earner', 'Log your first income', '💰', 'Transaction', 30, 'common', { type: 'first_transaction' }),
        a('regular_earner', 'Regular Earner', 'Log 10 income transactions', '💵', 'Transaction', 75, 'common', { type: 'transaction_count', count: 10 }),
        a('side_hustle_king', 'Side Hustle King', 'Log income from 3 different sources', '👨‍💼', 'Transaction', 100, 'rare', { type: 'transaction_count', count: 3 }),
        a('detail_oriented', 'Detail Oriented', 'Add descriptions to 50 transactions', '📋', 'Transaction', 75, 'common', { type: 'transaction_count', count: 50 }),
        a('category_explorer', 'Category Explorer', 'Use 10 different expense categories', '🗂️', 'Transaction', 100, 'rare', { type: 'transaction_count', count: 10 }),
        a('category_master_tx', 'Category Master', 'Use all 25 expense categories', '🎯', 'Transaction', 200, 'epic', { type: 'transaction_count', count: 25 }),
        a('night_owl', 'Night Owl', 'Log a transaction after midnight', '🦉', 'Transaction', 25, 'common', { type: 'first_transaction' }),
        a('early_bird', 'Early Bird', 'Log a transaction before 6 AM', '🐦', 'Transaction', 25, 'common', { type: 'first_transaction' }),
        // Budget (18)
        a('first_budget', 'Budget Beginner', 'Create your first Quick Budget', '📊', 'Budget', 30, 'common', { type: 'first_budget' }),
        a('budget_trio', 'Budget Trio', 'Create 3 Quick Budgets', '📈', 'Budget', 75, 'common', { type: 'budget_count', count: 3 }),
        a('budget_master', 'Budget Master', 'Create 10 budgets', '💼', 'Budget', 150, 'rare', { type: 'budget_count', count: 10 }),
        a('under_budget', 'Under Budget', 'Stay under budget for a full month', '✅', 'Budget', 100, 'rare', { type: 'under_budget', count: 1 }),
        a('budget_perfectionist', 'Budget Perfectionist', 'Stay under budget for 3 consecutive months', '🎯', 'Budget', 200, 'epic', { type: 'under_budget', count: 3 }),
        a('budget_legend', 'Budget Legend', 'Stay under budget for 6 consecutive months', '👑', 'Budget', 300, 'legendary', { type: 'under_budget', count: 6 }),
        a('penny_pincher', 'Penny Pincher', 'Spend exactly 95-100% of budget', '🪙', 'Budget', 75, 'common', { type: 'first_budget' }),
        a('budget_saver', 'Budget Saver', 'Save 20% or more from budget', '💰', 'Budget', 100, 'rare', { type: 'under_budget', count: 1 }),
        a('frugal_student', 'Frugal Student', 'Save 50% or more from budget', '🎓', 'Budget', 200, 'epic', { type: 'under_budget', count: 1 }),
        a('comprehensive_planner', 'Comprehensive Planner', 'Create your first Comprehensive Budget', '📋', 'Budget', 150, 'rare', { type: 'first_budget' }),
        a('semester_planner', 'Semester Planner', 'Create a semester-long budget', '📚', 'Budget', 100, 'rare', { type: 'first_budget' }),
        a('category_budgeter', 'Category Budgeter', 'Create budgets for 5 different categories', '🗂️', 'Budget', 125, 'rare', { type: 'budget_count', count: 5 }),
        a('budget_optimizer', 'Budget Optimizer', 'Update a budget 5 times to optimize', '⚙️', 'Budget', 75, 'common', { type: 'first_budget' }),
        a('early_warning', 'Early Warning', 'Receive and heed 80% budget warning', '⚠️', 'Budget', 50, 'common', { type: 'first_budget' }),
        a('budget_recovery', 'Budget Recovery', 'Go over budget then stay under next month', '🔄', 'Budget', 100, 'rare', { type: 'under_budget', count: 1 }),
        a('weekly_budgeter', 'Weekly Budgeter', 'Create 4 weekly budgets in a month', '📅', 'Budget', 100, 'rare', { type: 'budget_count', count: 4 }),
        a('budget_analyst', 'Budget Analyst', 'Compare 3 months of budget performance', '📊', 'Budget', 125, 'rare', { type: 'under_budget', count: 3 }),
        a('zero_based_budgeter', 'Zero-Based Budgeter', 'Allocate 100% of income in budget', '🎯', 'Budget', 150, 'epic', { type: 'first_budget' }),
        // Savings (16)
        a('first_goal', 'Goal Setter', 'Create your first savings goal', '🎯', 'Savings', 30, 'common', { type: 'first_goal' }),
        a('goal_trio', 'Goal Trio', 'Create 3 savings goals', '🌟', 'Savings', 75, 'common', { type: 'goal_completed', count: 1 }),
        a('goal_achiever', 'Goal Achiever', 'Complete your first savings goal', '🏆', 'Savings', 150, 'rare', { type: 'goal_completed', count: 1 }),
        a('serial_saver', 'Serial Saver', 'Complete 3 savings goals', '💪', 'Savings', 250, 'epic', { type: 'goal_completed', count: 3 }),
        a('savings_legend', 'Savings Legend', 'Complete 10 savings goals', '👑', 'Savings', 500, 'legendary', { type: 'goal_completed', count: 10 }),
        a('small_saver', 'Small Saver', 'Save GHS 100 total', '💰', 'Savings', 50, 'common', { type: 'savings_amount', amount: 100 }),
        a('medium_saver', 'Medium Saver', 'Save GHS 500 total', '💵', 'Savings', 100, 'common', { type: 'savings_amount', amount: 500 }),
        a('big_saver', 'Big Saver', 'Save GHS 1000 total', '💎', 'Savings', 200, 'rare', { type: 'savings_amount', amount: 1000 }),
        a('major_saver', 'Major Saver', 'Save GHS 5000 total', '🏦', 'Savings', 400, 'epic', { type: 'savings_amount', amount: 5000 }),
        a('savings_master', 'Savings Master', 'Save GHS 10000 total', '🌟', 'Savings', 600, 'legendary', { type: 'savings_amount', amount: 10000 }),
        a('emergency_fund', 'Emergency Fund', 'Create an emergency fund goal', '🛡️', 'Savings', 100, 'rare', { type: 'first_goal' }),
        a('quick_saver', 'Quick Saver', 'Complete a goal in under 30 days', '⚡', 'Savings', 150, 'rare', { type: 'goal_completed', count: 1 }),
        a('consistent_saver', 'Consistent Saver', 'Add to savings for 7 consecutive days', '📅', 'Savings', 100, 'rare', { type: 'goal_completed', count: 1 }),
        a('goal_planner', 'Goal Planner', 'Set a goal with a deadline', '📋', 'Savings', 50, 'common', { type: 'first_goal' }),
        a('overachiever', 'Overachiever', 'Exceed a savings goal by 10%', '🚀', 'Savings', 200, 'epic', { type: 'goal_completed', count: 1 }),
        a('savings_streak', 'Savings Streak', 'Contribute to savings for 30 consecutive days', '🔥', 'Savings', 250, 'epic', { type: 'goal_completed', count: 1 }),
        // Streak (14)
        a('streak_3', '3-Day Streak', 'Log transactions for 3 days in a row', '🔥', 'Streak', 25, 'common', { type: 'streak_milestone', days: 3 }),
        a('streak_7', 'Week Warrior', 'Maintain a 7-day streak', '⚡', 'Streak', 75, 'common', { type: 'streak_milestone', days: 7 }),
        a('streak_14', 'Two Week Titan', 'Maintain a 14-day streak', '💪', 'Streak', 125, 'rare', { type: 'streak_milestone', days: 14 }),
        a('streak_30', 'Monthly Master', 'Maintain a 30-day streak', '🌟', 'Streak', 200, 'rare', { type: 'streak_milestone', days: 30 }),
        a('streak_60', 'Two Month Marvel', 'Maintain a 60-day streak', '💎', 'Streak', 300, 'epic', { type: 'streak_milestone', days: 60 }),
        a('streak_90', 'Quarter Champion', 'Maintain a 90-day streak', '🏆', 'Streak', 400, 'epic', { type: 'streak_milestone', days: 90 }),
        a('streak_180', 'Half Year Hero', 'Maintain a 180-day streak', '👑', 'Streak', 600, 'legendary', { type: 'streak_milestone', days: 180 }),
        a('streak_365', 'Year Legend', 'Maintain a 365-day streak', '🌈', 'Streak', 1000, 'legendary', { type: 'streak_milestone', days: 365 }),
        a('streak_recovery', 'Streak Recovery', 'Recover from a broken streak', '🔄', 'Streak', 50, 'common', { type: 'streak_milestone', days: 3 }),
        a('weekend_warrior', 'Weekend Warrior', 'Log transactions on 4 consecutive weekends', '⚔️', 'Streak', 100, 'rare', { type: 'streak_milestone', days: 7 }),
        a('morning_routine', 'Morning Routine', 'Log transactions before 9 AM for 7 days', '🌅', 'Streak', 75, 'common', { type: 'streak_milestone', days: 7 }),
        a('evening_tracker', 'Evening Tracker', 'Log transactions after 6 PM for 7 days', '🌙', 'Streak', 75, 'common', { type: 'streak_milestone', days: 7 }),
        a('consistency_king', 'Consistency King', 'Never miss a day for 2 weeks', '👑', 'Streak', 150, 'rare', { type: 'streak_milestone', days: 14 }),
        a('habit_former', 'Habit Former', 'Log transactions for 21 consecutive days', '🧠', 'Streak', 175, 'rare', { type: 'streak_milestone', days: 21 }),
        // Category Master (15)
        a('food_master', 'Food Master', 'Log 20 food transactions', '🍔', 'Category Master', 75, 'common', { type: 'category_usage', category: 'food_drinks', count: 20 }),
        a('transport_master', 'Transport Master', 'Log 20 transport transactions', '🚗', 'Category Master', 75, 'common', { type: 'category_usage', category: 'trotro_transport', count: 20 }),
        a('entertainment_master', 'Entertainment Master', 'Log 20 entertainment transactions', '🎮', 'Category Master', 75, 'common', { type: 'category_usage', category: 'entertainment', count: 20 }),
        a('shopping_master', 'Shopping Master', 'Log 20 shopping transactions', '🛍️', 'Category Master', 75, 'common', { type: 'category_usage', category: 'clothing_fashion', count: 20 }),
        a('health_master', 'Health Master', 'Log 20 health transactions', '💊', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'healthcare', count: 20 }),
        a('education_master', 'Education Master', 'Log 20 education transactions', '📚', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'textbooks_materials', count: 20 }),
        a('utilities_master', 'Utilities Master', 'Log 20 utility transactions', '💡', 'Category Master', 75, 'common', { type: 'category_usage', category: 'utilities_bills', count: 20 }),
        a('dining_master', 'Dining Master', 'Log 20 dining transactions', '🍽️', 'Category Master', 75, 'common', { type: 'category_usage', category: 'food_drinks', count: 20 }),
        a('tech_master', 'Tech Master', 'Log 20 tech transactions', '💻', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'data_airtime', count: 20 }),
        a('travel_master', 'Travel Master', 'Log 20 travel transactions', '✈️', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'trotro_transport', count: 20 }),
        a('fitness_master', 'Fitness Master', 'Log 20 fitness transactions', '💪', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'healthcare', count: 20 }),
        a('beauty_master', 'Beauty Master', 'Log 20 beauty transactions', '💄', 'Category Master', 75, 'common', { type: 'category_usage', category: 'grooming_beauty', count: 20 }),
        a('subscription_master', 'Subscription Master', 'Log 20 subscription transactions', '📱', 'Category Master', 75, 'common', { type: 'category_usage', category: 'subscriptions', count: 20 }),
        a('housing_master', 'Housing Master', 'Log 20 housing transactions', '🏠', 'Category Master', 100, 'rare', { type: 'category_usage', category: 'accommodation', count: 20 }),
        a('social_master', 'Social Master', 'Log 20 social transactions', '👥', 'Category Master', 75, 'common', { type: 'category_usage', category: 'entertainment', count: 20 }),
        // Special (10)
        a('premium_member', 'Premium Member', 'Upgrade to Premium', '👑', 'Special', 200, 'epic', { type: 'premium_upgrade' }),
        a('business_mode', 'Business Mode', 'Enable Business Mode', '💼', 'Special', 150, 'rare', { type: 'business_mode' }),
        a('early_adopter', 'Early Adopter', 'Join in the first month', '🌟', 'Special', 300, 'legendary', { type: 'first_transaction' }),
        a('referral_master', 'Referral Master', 'Refer 5 friends', '🤝', 'Special', 250, 'epic', { type: 'first_transaction' }),
        a('feedback_giver', 'Feedback Giver', 'Submit app feedback', '💬', 'Special', 50, 'common', { type: 'first_transaction' }),
        a('profile_complete', 'Profile Complete', 'Complete your profile', '✅', 'Special', 75, 'common', { type: 'first_transaction' }),
        a('onboarding_complete', 'Onboarding Complete', 'Complete the onboarding flow', '🎓', 'Special', 100, 'common', { type: 'first_transaction' }),
        a('dark_mode_user', 'Dark Mode User', 'Enable dark mode', '🌙', 'Special', 25, 'common', { type: 'first_transaction' }),
        a('notification_enabled', 'Notification Enabled', 'Enable notifications', '🔔', 'Special', 25, 'common', { type: 'first_transaction' }),
        a('data_exporter', 'Data Exporter', 'Export your financial data', '📊', 'Special', 100, 'rare', { type: 'first_transaction' }),
        // Meta (11)
        a('achievement_hunter', 'Achievement Hunter', 'Unlock 10 achievements', '🏅', 'Meta', 100, 'rare', { type: 'achievement_count', count: 10 }),
        a('achievement_collector', 'Achievement Collector', 'Unlock 25 achievements', '🎖️', 'Meta', 200, 'epic', { type: 'achievement_count', count: 25 }),
        a('achievement_master', 'Achievement Master', 'Unlock 50 achievements', '🏆', 'Meta', 400, 'legendary', { type: 'achievement_count', count: 50 }),
        a('perfect_week', 'Perfect Week', 'Log transactions every day for a week', '⭐', 'Meta', 150, 'rare', { type: 'perfect_week' }),
        a('perfect_month', 'Perfect Month', 'Log transactions every day for a month', '🌟', 'Meta', 300, 'epic', { type: 'perfect_week' }),
        a('financial_guru', 'Financial Guru', 'Achieve all budget and savings goals in a month', '🧙', 'Meta', 500, 'legendary', { type: 'achievement_count', count: 5 }),
        a('xp_100', 'XP Milestone 100', 'Earn 100 XP', '⚡', 'Meta', 25, 'common', { type: 'achievement_count', count: 1 }),
        a('xp_500', 'XP Milestone 500', 'Earn 500 XP', '💫', 'Meta', 50, 'common', { type: 'achievement_count', count: 5 }),
        a('xp_1000', 'XP Milestone 1000', 'Earn 1000 XP', '🌟', 'Meta', 100, 'rare', { type: 'achievement_count', count: 10 }),
        a('xp_5000', 'XP Milestone 5000', 'Earn 5000 XP', '💎', 'Meta', 200, 'epic', { type: 'achievement_count', count: 25 }),
        a('level_10', 'Level 10', 'Reach level 10', '👑', 'Meta', 300, 'legendary', { type: 'achievement_count', count: 50 }),
    ];
}
//# sourceMappingURL=seedAchievements.js.map