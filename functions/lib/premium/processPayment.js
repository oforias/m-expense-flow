"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.paystackWebhook = exports.processPayment = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
// Paystack configuration — reads from .env (PAYSTACK_SECRET_KEY)
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'placeholder';
exports.processPayment = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, planType, amount, currency, email, paymentMethod } = data;
    // Verify user can only process their own payment
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot process payment for other users');
    }
    try {
        const db = admin.firestore();
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        // Validate payment amount
        const expectedAmounts = {
            monthly: 19.00,
            semester: 95.00,
            yearly: 180.00 // GHS 180/year
        };
        if (Math.abs(amount - expectedAmounts[planType]) > 0.01) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid payment amount');
        }
        // Generate unique reference
        const reference = `mexpense_${userId}_${planType}_${Date.now()}`;
        // Initialize Paystack transaction
        const paystackData = {
            email: email,
            amount: Math.round(amount * 100),
            currency: currency,
            reference: reference,
            callback_url: `https://your-app.com/payment-success`,
            metadata: {
                userId: userId,
                planType: planType,
                custom_fields: [
                    {
                        display_name: "Plan Type",
                        variable_name: "plan_type",
                        value: planType
                    },
                    {
                        display_name: "User ID",
                        variable_name: "user_id",
                        value: userId
                    }
                ]
            },
            channels: paymentMethod === 'mobile_money'
                ? ['mobile_money']
                : paymentMethod === 'bank_transfer'
                    ? ['bank']
                    : ['card', 'bank', 'mobile_money'] // Allow all for card
        };
        const response = await axios_1.default.post('https://api.paystack.co/transaction/initialize', paystackData, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.data.status) {
            throw new Error(`Paystack initialization failed: ${response.data.message}`);
        }
        // Store pending payment in Firestore
        await db.collection('pending_payments').doc(reference).set({
            userId: userId,
            planType: planType,
            amount: amount,
            currency: currency,
            reference: reference,
            status: 'pending',
            paystackAccessCode: response.data.data.access_code,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        });
        return {
            success: true,
            paymentUrl: response.data.data.authorization_url,
            reference: reference,
            accessCode: response.data.data.access_code,
            message: 'Payment initialized successfully'
        };
    }
    catch (error) {
        console.error('Error processing payment:', error);
        throw new functions.https.HttpsError('internal', `Failed to process payment: ${error}`);
    }
});
// Webhook to handle Paystack payment notifications
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
    try {
        // Verify webhook signature
        const hash = req.headers['x-paystack-signature'];
        const body = JSON.stringify(req.body);
        const expectedHash = require('crypto')
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(body)
            .digest('hex');
        if (hash !== expectedHash) {
            console.error('Invalid webhook signature');
            res.status(400).send('Invalid signature');
            return;
        }
        const event = req.body;
        if (event.event === 'charge.success') {
            await handleSuccessfulPayment(event.data);
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Webhook error');
    }
});
async function handleSuccessfulPayment(paymentData) {
    var _a;
    const db = admin.firestore();
    const reference = paymentData.reference;
    try {
        // Get pending payment
        const pendingPaymentDoc = await db.collection('pending_payments').doc(reference).get();
        if (!pendingPaymentDoc.exists) {
            console.error('Pending payment not found:', reference);
            return;
        }
        const pendingPayment = pendingPaymentDoc.data();
        const { userId, planType, amount } = pendingPayment;
        // Calculate expiry date
        const expiryDate = new Date();
        switch (planType) {
            case 'monthly':
                expiryDate.setMonth(expiryDate.getMonth() + 1);
                break;
            case 'semester':
                expiryDate.setMonth(expiryDate.getMonth() + 6);
                break;
            case 'yearly':
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                break;
        }
        // Update user to premium
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        await userDoc.ref.update({
            isPremium: true,
            premiumExpiryDate: expiryDate,
            subscriptionId: `sub_${reference}`,
            subscriptionPlan: 'premium',
            subscriptionDuration: planType,
            lastPaymentDate: new Date(),
            lastPaymentAmount: amount,
            updatedAt: new Date()
        });
        // Award premium achievement if not already unlocked
        const achievementDoc = await db.collection('users').doc(userId)
            .collection('achievements').doc('premium_upgrade').get();
        if (!achievementDoc.exists || !((_a = achievementDoc.data()) === null || _a === void 0 ? void 0 : _a.unlocked)) {
            await db.collection('users').doc(userId).collection('achievements').doc('premium_upgrade').set({
                achievementId: 'premium_upgrade',
                userId: userId,
                unlocked: true,
                unlockedDate: new Date(),
                xpAwarded: 100
            });
            // Award XP
            await userDoc.ref.update({
                xp: (userData.xp || 0) + 100
            });
        }
        // Store payment record
        await db.collection('users').doc(userId).collection('payments').add({
            reference: reference,
            amount: amount,
            currency: 'GHS',
            planType: planType,
            status: 'completed',
            paystackReference: paymentData.reference,
            paidAt: new Date(paymentData.paid_at),
            createdAt: new Date()
        });
        // Update pending payment status
        await pendingPaymentDoc.ref.update({
            status: 'completed',
            completedAt: new Date(),
            paystackData: paymentData
        });
        console.log(`Premium activated for user ${userId} with plan ${planType}`);
    }
    catch (error) {
        console.error('Error handling successful payment:', error);
    }
}
// Function to verify payment status manually
exports.verifyPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const response = await axios_1.default.get(`https://api.paystack.co/transaction/verify/${data.reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        });
        if (response.data.status && response.data.data.status === 'success') {
            await handleSuccessfulPayment(response.data.data);
            return { success: true, message: 'Payment verified and premium activated' };
        }
        return { success: false, message: 'Payment not successful' };
    }
    catch (error) {
        console.error('Error verifying payment:', error);
        throw new functions.https.HttpsError('internal', 'Failed to verify payment');
    }
});
//# sourceMappingURL=processPayment.js.map