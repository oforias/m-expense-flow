import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface AwardXPData {
  userId: string;
  amount: number;
  reason: string;
  context?: {
    transactionId?: string;
    budgetId?: string;
    achievementId?: string;
    challengeId?: string;
  };
}

export const awardXP = async (data: AwardXPData, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (context.auth.uid !== data.userId) {
    throw new functions.https.HttpsError('permission-denied', 'User can only award XP to themselves');
  }

  if (data.amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'XP amount must be positive');
  }

  const db = admin.firestore();

  try {
    // Get current user data
    const userDoc = await db.collection('users').doc(data.userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data()!;
    const currentXP = userData.xp || 0;
    const currentLevel = userData.level || 1;
    
    // Calculate new XP and level
    const newXP = currentXP + data.amount;
    const newLevel = Math.floor(newXP / 100) + 1;
    const leveledUp = newLevel > currentLevel;

    // Update user document
    const userRef = db.collection('users').doc(data.userId);
    await userRef.update({
      xp: newXP,
      level: newLevel,
      lastXPAward: {
        amount: data.amount,
        reason: data.reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        context: data.context || null
      }
    });

    // Log XP transaction for history
    await db.collection('users').doc(data.userId)
      .collection('xp_history').add({
        amount: data.amount,
        reason: data.reason,
        context: data.context || null,
        previousXP: currentXP,
        newXP: newXP,
        previousLevel: currentLevel,
        newLevel: newLevel,
        leveledUp: leveledUp,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

    // Update leaderboards if significant XP gain
    if (data.amount >= 5) {
      await updateLeaderboardsForXP(data.userId, data.amount);
    }

    // Check for level-up achievements
    if (leveledUp) {
      await checkLevelAchievements(data.userId, newLevel);
    }

    return {
      success: true,
      previousXP: currentXP,
      newXP: newXP,
      previousLevel: currentLevel,
      newLevel: newLevel,
      leveledUp: leveledUp,
      xpAwarded: data.amount
    };

  } catch (error) {
    console.error('Error awarding XP:', error);
    throw new functions.https.HttpsError('internal', 'Failed to award XP');
  }
};

async function updateLeaderboardsForXP(userId: string, xpGained: number) {
  const db = admin.firestore();
  
  try {
    // Get user data for leaderboard update
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data()!;
    const anonymousUsername = generateAnonymousUsername(userData.name, userId);

    const batch = db.batch();

    // Update weekly leaderboard
    const weeklyRef = db.collection('leaderboards').doc('weekly').collection('entries').doc(userId);
    const weeklyDoc = await weeklyRef.get();
    
    if (weeklyDoc.exists) {
      batch.update(weeklyRef, {
        xp: admin.firestore.FieldValue.increment(xpGained),
        level: userData.level,
        streak: userData.streak || 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.set(weeklyRef, {
        userId: userId,
        anonymousUsername,
        university: userData.university || null,
        level: userData.level,
        xp: xpGained,
        totalXp: userData.xp,
        streak: userData.streak || 0,
        rank: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update monthly leaderboard
    const monthlyRef = db.collection('leaderboards').doc('monthly').collection('entries').doc(userId);
    const monthlyDoc = await monthlyRef.get();
    
    if (monthlyDoc.exists) {
      batch.update(monthlyRef, {
        xp: admin.firestore.FieldValue.increment(xpGained),
        level: userData.level,
        streak: userData.streak || 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.set(monthlyRef, {
        userId: userId,
        anonymousUsername,
        university: userData.university || null,
        level: userData.level,
        xp: xpGained,
        totalXp: userData.xp,
        streak: userData.streak || 0,
        rank: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update all-time leaderboard
    const allTimeRef = db.collection('leaderboards').doc('all_time').collection('entries').doc(userId);
    const allTimeDoc = await allTimeRef.get();
    
    if (allTimeDoc.exists) {
      batch.update(allTimeRef, {
        totalXp: userData.xp,
        level: userData.level,
        streak: userData.streak || 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.set(allTimeRef, {
        userId: userId,
        anonymousUsername,
        university: userData.university || null,
        level: userData.level,
        xp: 0,
        totalXp: userData.xp,
        streak: userData.streak || 0,
        rank: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

  } catch (error) {
    console.error('Error updating leaderboards for XP:', error);
  }
}

async function checkLevelAchievements(userId: string, newLevel: number) {
  const db = admin.firestore();
  
  try {
    // Get level-based achievements
    const achievementsSnapshot = await db.collection('global').doc('achievements').get();
    if (!achievementsSnapshot.exists) return;

    const allAchievements = achievementsSnapshot.data()!.achievements;
    const levelAchievements = allAchievements.filter((a: any) => 
      a.category === 'Level' && a.unlockConditions.level <= newLevel
    );

    // Get user's current achievements
    const userAchievementsSnapshot = await db.collection('users').doc(userId)
      .collection('achievements').get();
    
    const unlockedAchievementIds = new Set(
      userAchievementsSnapshot.docs
        .filter(doc => doc.data().unlocked)
        .map(doc => doc.id)
    );

    const batch = db.batch();
    let totalBonusXP = 0;

    // Check each level achievement
    for (const achievement of levelAchievements) {
      if (!unlockedAchievementIds.has(achievement.achievementId)) {
        // Unlock this achievement
        const achievementRef = db.collection('users').doc(userId)
          .collection('achievements').doc(achievement.achievementId);
        
        batch.set(achievementRef, {
          achievementId: achievement.achievementId,
          userId: userId,
          unlocked: true,
          unlockedDate: admin.firestore.FieldValue.serverTimestamp(),
          xpAwarded: achievement.xpReward
        });

        totalBonusXP += achievement.xpReward;
      }
    }

    // Award bonus XP if any achievements were unlocked
    if (totalBonusXP > 0) {
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        xp: admin.firestore.FieldValue.increment(totalBonusXP)
      });
    }

    await batch.commit();

  } catch (error) {
    console.error('Error checking level achievements:', error);
  }
}

function generateAnonymousUsername(name: string, userId: string): string {
  const adjectives = [
    'Smart', 'Wise', 'Clever', 'Bright', 'Sharp', 'Quick', 'Swift', 'Bold',
    'Brave', 'Strong', 'Fast', 'Cool', 'Super', 'Mega', 'Ultra', 'Pro'
  ];
  
  const animals = [
    'Eagle', 'Lion', 'Tiger', 'Panther', 'Wolf', 'Fox', 'Hawk', 'Falcon',
    'Shark', 'Dolphin', 'Cheetah', 'Leopard', 'Bear', 'Rhino', 'Elephant', 'Giraffe'
  ];
  
  // Use userId hash to ensure consistency
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const adjIndex = Math.abs(hash) % adjectives.length;
  const animalIndex = Math.abs(hash >> 8) % animals.length;
  const number = Math.abs(hash >> 16) % 1000;
  
  return `${adjectives[adjIndex]}${animals[animalIndex]}${number}`;
}