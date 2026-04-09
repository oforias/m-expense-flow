"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBusinessTemplate = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
const applyBusinessTemplate = async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Verify user ID matches authenticated user
    if (context.auth.uid !== data.userId) {
        throw new functions.https.HttpsError('permission-denied', 'User can only access their own data');
    }
    try {
        const { userId, templateId } = data;
        // Check if user is premium
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        if (!userData.isPremium) {
            throw new functions.https.HttpsError('permission-denied', 'Business Mode is a Premium feature');
        }
        // Check if business mode is enabled
        if (!userData.businessModeEnabled) {
            throw new functions.https.HttpsError('failed-precondition', 'Business Mode is not enabled');
        }
        // Get business templates from global collection
        const templatesDoc = await db.collection('global').doc('business_templates').get();
        if (!templatesDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Business templates not found');
        }
        const templatesData = templatesDoc.data();
        const templates = templatesData.templates;
        // Find the requested template
        const template = templates.find(t => t.templateId === templateId);
        if (!template) {
            throw new functions.https.HttpsError('not-found', `Template ${templateId} not found`);
        }
        // Create business budget based on template
        const budgetId = db.collection('users').doc(userId).collection('business_budgets').doc().id;
        const now = admin.firestore.Timestamp.now();
        const budgetData = {
            budgetId,
            userId,
            templateId: template.templateId,
            templateName: template.name,
            description: template.description,
            categoryPercentages: template.categoryPercentages,
            targetProfitMargin: template.targetProfitMargin,
            suggestedCategories: template.suggestedCategories,
            isActive: true,
            appliedAt: now,
            createdAt: now,
            updatedAt: now,
        };
        // Save business budget to Firestore
        await db
            .collection('users')
            .doc(userId)
            .collection('business_budgets')
            .doc(budgetId)
            .set(budgetData);
        // Log the template application
        await db
            .collection('users')
            .doc(userId)
            .collection('activity_log')
            .add({
            action: 'business_template_applied',
            templateId: template.templateId,
            templateName: template.name,
            budgetId,
            timestamp: now,
            details: `Applied ${template.name} business template`,
        });
        // Return the created budget data
        return {
            success: true,
            budgetId,
            template: {
                templateId: template.templateId,
                name: template.name,
                description: template.description,
                targetProfitMargin: template.targetProfitMargin,
            },
            budgetData: Object.assign(Object.assign({}, budgetData), { appliedAt: budgetData.appliedAt.toDate().toISOString(), createdAt: budgetData.createdAt.toDate().toISOString(), updatedAt: budgetData.updatedAt.toDate().toISOString() }),
            message: `Successfully applied ${template.name} template`,
        };
    }
    catch (error) {
        console.error('Error applying business template:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to apply business template');
    }
};
exports.applyBusinessTemplate = applyBusinessTemplate;
//# sourceMappingURL=applyBusinessTemplate.js.map