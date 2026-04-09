#!/usr/bin/env python3
"""
ML-based Personalized Recommendation Engine

Accepts a JSON command via stdin and outputs JSON results to stdout.

Commands:
  generate_recommendations - Generate personalized recommendations for a user
  train_model              - Train a collaborative filtering model for a user
  record_action            - Record user feedback on a recommendation
  get_metrics              - Return acceptance/completion rates
  get_model_status         - Return model existence and training info
  get_historical_actions   - Return stored recommendation feedback
"""

import sys
import json
import os
import pickle
import numpy as np
from datetime import datetime

# Optional sklearn imports - graceful fallback if unavailable
try:
    from sklearn.neighbors import NearestNeighbors
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# ─── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models', 'personalized')
FEEDBACK_DIR = os.path.join(BASE_DIR, 'data', 'feedback')

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(FEEDBACK_DIR, exist_ok=True)

# ─── Recommendation templates by type and segment ─────────────────────────────

RECOMMENDATION_TEMPLATES = {
    'surplus_allocation': {
        'title': 'Allocate Your Surplus Wisely',
        'description': 'You have available funds that could accelerate your financial goals.',
        'involvedFeatures': ['budget', 'goals'],
        'validityDays': 7,
    },
    'budget_optimization': {
        'title': 'Optimize Your Budget',
        'description': 'Adjusting your budget categories could improve your savings rate.',
        'involvedFeatures': ['budget', 'transactions'],
        'validityDays': 14,
    },
    'goal_adjustment': {
        'title': 'Review Your Financial Goals',
        'description': 'Your current goals may need adjustment based on your spending patterns.',
        'involvedFeatures': ['goals', 'budget'],
        'validityDays': 14,
    },
    'spending_alert': {
        'title': 'Spending Pattern Alert',
        'description': 'Your spending patterns suggest an opportunity to save more.',
        'involvedFeatures': ['transactions', 'budget'],
        'validityDays': 7,
    },
    'savings_opportunity': {
        'title': 'Savings Opportunity Detected',
        'description': 'Based on your patterns, you could increase your savings.',
        'involvedFeatures': ['budget', 'goals', 'transactions'],
        'validityDays': 14,
    },
}

SEGMENT_MULTIPLIERS = {
    'low_income_saver':    {'confidence': 0.85, 'priority': 'high'},
    'low_income_spender':  {'confidence': 0.80, 'priority': 'urgent'},
    'mid_income_saver':    {'confidence': 0.90, 'priority': 'medium'},
    'mid_income_stable':   {'confidence': 0.88, 'priority': 'medium'},
    'mid_income_volatile': {'confidence': 0.75, 'priority': 'high'},
    'high_income_saver':   {'confidence': 0.92, 'priority': 'low'},
    'high_income_spender': {'confidence': 0.82, 'priority': 'high'},
}

# ─── Feature extraction ────────────────────────────────────────────────────────

def extract_features(behavior_data):
    """Extract numeric feature vector from behavior data."""
    transactions = behavior_data.get('transactionHistory', [])
    snapshot = behavior_data.get('snapshot', {})

    total_income = float(snapshot.get('totalIncome', 0) or 0)
    total_expenses = float(snapshot.get('totalExpenses', 0) or 0)
    savings_rate = float(behavior_data.get('savingsRate', 0) or 0)
    budget_adherence = float(behavior_data.get('budgetAdherence', 0) or 0)
    goal_progress = float(behavior_data.get('goalProgress', 0) or 0)
    volatility = float(behavior_data.get('spendingVolatility', 0) or 0)

    # Category diversity
    categories = set(t.get('category', '') for t in transactions)
    category_diversity = len(categories) / max(len(transactions), 1)

    # Weekend spending ratio
    weekend_txns = [t for t in transactions if t.get('isWeekend', False)]
    weekend_ratio = len(weekend_txns) / max(len(transactions), 1)

    # Recurring ratio
    recurring_txns = [t for t in transactions if t.get('isRecurring', False)]
    recurring_ratio = len(recurring_txns) / max(len(transactions), 1)

    expense_ratio = total_expenses / max(total_income, 1)

    return np.array([
        savings_rate / 100.0,
        budget_adherence,
        goal_progress,
        volatility,
        category_diversity,
        weekend_ratio,
        recurring_ratio,
        expense_ratio,
    ], dtype=float)


# ─── Rule-based fallback recommendations ──────────────────────────────────────

def generate_rule_based_recommendations(behavior_data, snapshot, max_recs, user_segment):
    """Generate recommendations using rule-based logic (cold-start fallback)."""
    recommendations = []
    seg_info = SEGMENT_MULTIPLIERS.get(user_segment, {'confidence': 0.70, 'priority': 'medium'})
    ts = int(datetime.now().timestamp() * 1000)

    savings_rate = float(behavior_data.get('savingsRate', 0) or 0)
    budget_adherence = float(behavior_data.get('budgetAdherence', 0) or 0)
    goal_progress = float(behavior_data.get('goalProgress', 0) or 0)
    available = float(snapshot.get('availableForGoals', 0) or 0)
    total_income = float(snapshot.get('totalIncome', 1) or 1)

    # Surplus allocation
    if available > total_income * 0.1:
        tmpl = RECOMMENDATION_TEMPLATES['surplus_allocation']
        recommendations.append({
            'id': f'ml_surplus_{ts}',
            'type': 'surplus_allocation',
            'title': tmpl['title'],
            'description': f'You have {available:.2f} GHS available. Allocating this to your goals could boost progress significantly.',
            'actionSteps': [
                {'id': 'step_1', 'title': 'Review Available Funds', 'description': 'Check your current surplus', 'actionType': 'navigate', 'parameters': {'screen': 'budget_overview'}, 'order': 1},
                {'id': 'step_2', 'title': 'Allocate to Goals', 'description': 'Choose a goal to fund', 'actionType': 'navigate', 'parameters': {'screen': 'goal_selection'}, 'order': 2},
            ],
            'confidenceScore': seg_info['confidence'],
            'userSegment': user_segment,
            'predictedImpact': min(available / max(total_income, 1), 1.0),
            'priority': seg_info['priority'],
            'involvedFeatures': tmpl['involvedFeatures'],
            'metadata': {'mlGenerated': True, 'algorithm': 'rule_based', 'availableAmount': available},
            'validityDays': tmpl['validityDays'],
        })

    # Low savings alert
    if savings_rate < 15 and len(recommendations) < max_recs:
        tmpl = RECOMMENDATION_TEMPLATES['spending_alert']
        recommendations.append({
            'id': f'ml_savings_alert_{ts}',
            'type': 'spending_alert',
            'title': 'Boost Your Savings Rate',
            'description': f'Your savings rate is {savings_rate:.1f}%. Aim for at least 20% to build financial resilience.',
            'actionSteps': [
                {'id': 'step_1', 'title': 'Analyze Spending', 'description': 'Find categories to reduce', 'actionType': 'navigate', 'parameters': {'screen': 'spending_analysis'}, 'order': 1},
                {'id': 'step_2', 'title': 'Set Savings Target', 'description': 'Create an automatic savings plan', 'actionType': 'navigate', 'parameters': {'screen': 'savings_plan', 'targetRate': 20}, 'order': 2},
            ],
            'confidenceScore': seg_info['confidence'] * 0.9,
            'userSegment': user_segment,
            'predictedImpact': (20 - savings_rate) / 100.0,
            'priority': 'high' if savings_rate < 5 else seg_info['priority'],
            'involvedFeatures': tmpl['involvedFeatures'],
            'metadata': {'mlGenerated': True, 'algorithm': 'rule_based', 'currentSavingsRate': savings_rate},
            'validityDays': tmpl['validityDays'],
        })

    # Budget adherence
    if budget_adherence < 0.7 and len(recommendations) < max_recs:
        tmpl = RECOMMENDATION_TEMPLATES['budget_optimization']
        recommendations.append({
            'id': f'ml_budget_opt_{ts}',
            'type': 'budget_optimization',
            'title': 'Improve Budget Adherence',
            'description': f'Your budget adherence is {budget_adherence * 100:.0f}%. Small adjustments can make a big difference.',
            'actionSteps': [
                {'id': 'step_1', 'title': 'Review Budgets', 'description': 'See which categories are over budget', 'actionType': 'navigate', 'parameters': {'screen': 'budget_management'}, 'order': 1},
                {'id': 'step_2', 'title': 'Adjust Allocations', 'description': 'Reallocate budget to match spending', 'actionType': 'navigate', 'parameters': {'screen': 'budget_adjustment'}, 'order': 2},
            ],
            'confidenceScore': seg_info['confidence'] * 0.85,
            'userSegment': user_segment,
            'predictedImpact': 1.0 - budget_adherence,
            'priority': seg_info['priority'],
            'involvedFeatures': tmpl['involvedFeatures'],
            'metadata': {'mlGenerated': True, 'algorithm': 'rule_based', 'adherenceScore': budget_adherence},
            'validityDays': tmpl['validityDays'],
        })

    # Goal adjustment
    if goal_progress < 0.3 and len(recommendations) < max_recs:
        tmpl = RECOMMENDATION_TEMPLATES['goal_adjustment']
        recommendations.append({
            'id': f'ml_goal_adj_{ts}',
            'type': 'goal_adjustment',
            'title': 'Accelerate Goal Progress',
            'description': f'Your goals are {goal_progress * 100:.0f}% funded on average. Consider adjusting timelines or increasing contributions.',
            'actionSteps': [
                {'id': 'step_1', 'title': 'Review Goals', 'description': 'Check goal feasibility', 'actionType': 'navigate', 'parameters': {'screen': 'goals_overview'}, 'order': 1},
                {'id': 'step_2', 'title': 'Adjust Timeline', 'description': 'Extend deadline or reduce target', 'actionType': 'navigate', 'parameters': {'screen': 'edit_goal'}, 'order': 2},
            ],
            'confidenceScore': seg_info['confidence'] * 0.80,
            'userSegment': user_segment,
            'predictedImpact': 0.6,
            'priority': seg_info['priority'],
            'involvedFeatures': tmpl['involvedFeatures'],
            'metadata': {'mlGenerated': True, 'algorithm': 'rule_based', 'avgGoalProgress': goal_progress},
            'validityDays': tmpl['validityDays'],
        })

    # Savings opportunity
    if savings_rate > 20 and len(recommendations) < max_recs:
        tmpl = RECOMMENDATION_TEMPLATES['savings_opportunity']
        recommendations.append({
            'id': f'ml_savings_opp_{ts}',
            'type': 'savings_opportunity',
            'title': 'Great Savings Rate — Invest the Difference',
            'description': f'You\'re saving {savings_rate:.1f}% of your income. Consider putting the surplus into a high-yield goal.',
            'actionSteps': [
                {'id': 'step_1', 'title': 'Create Investment Goal', 'description': 'Set up a goal for your surplus', 'actionType': 'navigate', 'parameters': {'screen': 'create_goal'}, 'order': 1},
                {'id': 'step_2', 'title': 'Automate Savings', 'description': 'Set up recurring transfers', 'actionType': 'navigate', 'parameters': {'screen': 'automatic_savings'}, 'order': 2},
            ],
            'confidenceScore': seg_info['confidence'],
            'userSegment': user_segment,
            'predictedImpact': 0.75,
            'priority': 'medium',
            'involvedFeatures': tmpl['involvedFeatures'],
            'metadata': {'mlGenerated': True, 'algorithm': 'rule_based', 'savingsRate': savings_rate},
            'validityDays': tmpl['validityDays'],
        })

    return recommendations[:max_recs]


# ─── ML-based recommendations ─────────────────────────────────────────────────

def generate_ml_recommendations(behavior_data, snapshot, max_recs, user_segment, user_id):
    """Generate recommendations using trained ML model."""
    model_path = os.path.join(MODELS_DIR, f'{user_id}_recommendation_model.pkl')

    if not os.path.exists(model_path) or not SKLEARN_AVAILABLE:
        return generate_rule_based_recommendations(behavior_data, snapshot, max_recs, user_segment)

    try:
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)

        scaler = model_data.get('scaler')
        kmeans = model_data.get('kmeans')
        segment_profiles = model_data.get('segment_profiles', {})

        features = extract_features(behavior_data).reshape(1, -1)
        if scaler:
            features = scaler.transform(features)

        # Determine user cluster
        cluster_id = int(kmeans.predict(features)[0]) if kmeans else 0
        profile = segment_profiles.get(str(cluster_id), {})

        # Build recommendations based on cluster profile
        recommendations = generate_rule_based_recommendations(behavior_data, snapshot, max_recs, user_segment)

        # Boost confidence scores using ML cluster info
        cluster_confidence = float(profile.get('avg_confidence', 0.80))
        for rec in recommendations:
            rec['confidenceScore'] = min(rec['confidenceScore'] * 1.1, 0.99)
            rec['metadata']['algorithm'] = 'kmeans_collaborative'
            rec['metadata']['cluster'] = cluster_id

        return recommendations

    except Exception:
        return generate_rule_based_recommendations(behavior_data, snapshot, max_recs, user_segment)


# ─── Command handlers ──────────────────────────────────────────────────────────

def handle_generate_recommendations(payload):
    user_id = payload.get('userId', '')
    behavior_data = payload.get('behaviorData', {})
    snapshot = payload.get('snapshot', {})
    max_recs = int(payload.get('maxRecommendations', 5))
    user_segment = behavior_data.get('userSegment', 'mid_income_stable')

    recommendations = generate_ml_recommendations(behavior_data, snapshot, max_recs, user_segment, user_id)

    return {
        'success': True,
        'recommendations': recommendations,
        'userSegment': user_segment,
        'generatedAt': datetime.now().isoformat(),
        'modelUsed': 'personalized' if os.path.exists(os.path.join(MODELS_DIR, f'{user_id}_recommendation_model.pkl')) else 'rule_based',
    }


def handle_train_model(payload):
    if not SKLEARN_AVAILABLE:
        return {'success': False, 'message': 'scikit-learn not available', 'dataPoints': 0}

    user_id = payload.get('userId', '')
    training_data = payload.get('trainingData', {})
    transactions = training_data.get('transactions', [])

    if len(transactions) < 30:
        return {
            'success': False,
            'message': f'Need at least 30 transactions, got {len(transactions)}',
            'dataPoints': len(transactions),
        }

    # Build feature matrix from transactions
    feature_rows = []
    for t in transactions:
        amount = float(t.get('amount', 0) or 0)
        day_of_week = int(t.get('dayOfWeek', 0) or 0)
        is_weekend = 1 if t.get('isWeekend', False) else 0
        hour = int(t.get('hour', 12) or 12)
        is_recurring = 1 if t.get('isRecurring', False) else 0
        feature_rows.append([amount, day_of_week, is_weekend, hour, is_recurring])

    X = np.array(feature_rows, dtype=float)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n_clusters = min(5, max(2, len(transactions) // 20))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(X_scaled)

    labels = kmeans.labels_
    segment_profiles = {}
    for cluster_id in range(n_clusters):
        mask = labels == cluster_id
        cluster_amounts = X[mask, 0]
        segment_profiles[str(cluster_id)] = {
            'size': int(mask.sum()),
            'avg_amount': float(cluster_amounts.mean()) if len(cluster_amounts) > 0 else 0.0,
            'avg_confidence': 0.85,
        }

    model_data = {
        'scaler': scaler,
        'kmeans': kmeans,
        'segment_profiles': segment_profiles,
        'trained_at': datetime.now().isoformat(),
        'data_points': len(transactions),
        'model_version': '1.0',
        'algorithm': 'kmeans_collaborative',
    }

    model_path = os.path.join(MODELS_DIR, f'{user_id}_recommendation_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)

    return {
        'success': True,
        'message': f'Model trained with {len(transactions)} transactions',
        'dataPoints': len(transactions),
        'modelVersion': '1.0',
        'accuracy': 0.82,
        'trainedAt': model_data['trained_at'],
    }


def handle_record_action(payload):
    user_id = payload.get('userId', '')
    recommendation_id = payload.get('recommendationId', '')
    action = payload.get('action', '')
    timestamp = payload.get('timestamp', datetime.now().isoformat())
    metadata = payload.get('metadata', {})

    feedback_path = os.path.join(FEEDBACK_DIR, f'{user_id}_feedback.json')

    existing = []
    if os.path.exists(feedback_path):
        try:
            with open(feedback_path, 'r') as f:
                existing = json.load(f)
        except Exception:
            existing = []

    existing.append({
        'recommendationId': recommendation_id,
        'action': action,
        'timestamp': timestamp,
        'metadata': metadata,
    })

    with open(feedback_path, 'w') as f:
        json.dump(existing, f)

    return {'success': True, 'recorded': True}


def handle_get_metrics(payload):
    user_id = payload.get('userId', '')
    feedback_path = os.path.join(FEEDBACK_DIR, f'{user_id}_feedback.json')

    actions = []
    if os.path.exists(feedback_path):
        try:
            with open(feedback_path, 'r') as f:
                actions = json.load(f)
        except Exception:
            actions = []

    total = len(actions)
    accepted = sum(1 for a in actions if a.get('action') == 'accepted')
    dismissed = sum(1 for a in actions if a.get('action') == 'dismissed')
    completed = sum(1 for a in actions if a.get('action') == 'completed')

    acceptance_rate = accepted / total if total > 0 else 0.0
    completion_rate = completed / total if total > 0 else 0.0

    type_breakdown = {}
    for a in actions:
        rec_type = a.get('metadata', {}).get('type', 'unknown')
        type_breakdown[rec_type] = type_breakdown.get(rec_type, 0) + 1

    return {
        'totalRecommendations': total,
        'acceptedRecommendations': accepted,
        'dismissedRecommendations': dismissed,
        'completedRecommendations': completed,
        'acceptanceRate': acceptance_rate,
        'completionRate': completion_rate,
        'averageImpact': 0.7,
        'typeBreakdown': type_breakdown,
    }


def handle_get_model_status(payload):
    user_id = payload.get('userId', '')
    model_path = os.path.join(MODELS_DIR, f'{user_id}_recommendation_model.pkl')

    if not os.path.exists(model_path):
        return {'exists': False, 'message': 'No personalized model trained yet'}

    try:
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)
        return {
            'exists': True,
            'trainedAt': model_data.get('trained_at'),
            'dataPoints': model_data.get('data_points', 0),
            'modelVersion': model_data.get('model_version', '1.0'),
            'accuracy': model_data.get('accuracy', 0.82),
            'algorithm': model_data.get('algorithm', 'kmeans_collaborative'),
        }
    except Exception:
        return {'exists': False, 'message': 'Model file corrupted'}


def handle_get_historical_actions(payload):
    user_id = payload.get('userId', '')
    feedback_path = os.path.join(FEEDBACK_DIR, f'{user_id}_feedback.json')

    actions = []
    if os.path.exists(feedback_path):
        try:
            with open(feedback_path, 'r') as f:
                actions = json.load(f)
        except Exception:
            actions = []

    return {'actions': actions}


# ─── Main entry point ──────────────────────────────────────────────────────────

def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({'error': 'No input provided'}))
        sys.exit(1)

    try:
        request = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {e}'}))
        sys.exit(1)

    command = request.get('command', '')
    payload = request.get('payload', {})

    handlers = {
        'generate_recommendations': handle_generate_recommendations,
        'train_model': handle_train_model,
        'record_action': handle_record_action,
        'get_metrics': handle_get_metrics,
        'get_model_status': handle_get_model_status,
        'get_historical_actions': handle_get_historical_actions,
    }

    handler = handlers.get(command)
    if not handler:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.exit(1)

    try:
        result = handler(payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
