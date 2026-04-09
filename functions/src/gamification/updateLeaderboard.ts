import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface UpdateLeaderboardData {
  userId: string;
  xpGained: number;
  period: 'weekly' | 'monthly' | 'all_time';
}

export const updateLeaderboard = async (data: UpdateLeaderboardData, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (context.auth.uid !== data.userId) {
    throw new functions.https.HttpsError('permission-denied', 'User can only update their own leaderboard data');
  }

  const db = admin.firestore();
  const batch = db.batch();

  try {
    // Get user data
    const userDoc = await db.collection('users').doc(data.userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data()!;
    const anonymousUsername = generateAnonymousUsername(userData.name, data.userId);

    // Update weekly leaderboard
    if (data.period === 'weekly' || data.period === 'all_time') {
      const weeklyRef = db.collection('leaderboards').doc('weekly').collection('entries').doc(data.userId);
      const weeklyDoc = await weeklyRef.get();
      
      if (weeklyDoc.exists) {
        batch.update(weeklyRef, {
          xp: admin.firestore.FieldValue.increment(data.xpGained),
          level: userData.level,
          streak: userData.streak,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        batch.set(weeklyRef, {
          userId: data.userId,
          anonymousUsername,
          university: userData.university || null,
          level: userData.level,
          xp: data.xpGained,
          totalXp: userData.xp,
          streak: userData.streak,
          rank: 0, // Will be calculated by ranking function
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Update monthly leaderboard
    if (data.period === 'monthly' || data.period === 'all_time') {
      const monthlyRef = db.collection('leaderboards').doc('monthly').collection('entries').doc(data.userId);
      const monthlyDoc = await monthlyRef.get();
      
      if (monthlyDoc.exists) {
        batch.update(monthlyRef, {
          xp: admin.firestore.FieldValue.increment(data.xpGained),
          level: userData.level,
          streak: userData.streak,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        batch.set(monthlyRef, {
          userId: data.userId,
          anonymousUsername,
          university: userData.university || null,
          level: userData.level,
          xp: data.xpGained,
          totalXp: userData.xp,
          streak: userData.streak,
          rank: 0, // Will be calculated by ranking function
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Update all-time leaderboard
    const allTimeRef = db.collection('leaderboards').doc('all_time').collection('entries').doc(data.userId);
    const allTimeDoc = await allTimeRef.get();
    
    if (allTimeDoc.exists) {
      batch.update(allTimeRef, {
        totalXp: userData.xp,
        level: userData.level,
        streak: userData.streak,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.set(allTimeRef, {
        userId: data.userId,
        anonymousUsername,
        university: userData.university || null,
        level: userData.level,
        xp: 0, // Period XP for all-time is not used
        totalXp: userData.xp,
        streak: userData.streak,
        rank: 0, // Will be calculated by ranking function
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    // Trigger ranking calculation (run asynchronously)
    await calculateRankings(data.period);

    return {
      success: true,
      message: 'Leaderboard updated successfully'
    };

  } catch (error) {
    console.error('Error updating leaderboard:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update leaderboard');
  }
};

export const calculateRankings = async (period: 'weekly' | 'monthly' | 'all_time') => {
  const db = admin.firestore();
  
  try {
    const collectionRef = db.collection('leaderboards').doc(period).collection('entries');
    
    // Get all entries sorted by appropriate field
    let query;
    if (period === 'all_time') {
      query = collectionRef.orderBy('totalXp', 'desc');
    } else {
      query = collectionRef.orderBy('xp', 'desc');
    }
    
    const snapshot = await query.get();
    const batch = db.batch();
    
    // Update ranks
    snapshot.docs.forEach((doc, index) => {
      batch.update(doc.ref, { rank: index + 1 });
    });
    
    await batch.commit();
    
    console.log(`Rankings calculated for ${period} leaderboard`);
    
  } catch (error) {
    console.error(`Error calculating rankings for ${period}:`, error);
  }
};

export const resetLeaderboards = functions.pubsub.schedule('0 0 * * 0').onRun(async (context) => {
  const db = admin.firestore();
  try {
    const weeklySnapshot = await db.collection('leaderboards').doc('weekly').collection('entries').get();
    const archiveDate = new Date().toISOString().split('T')[0];
    const batch = db.batch();
    weeklySnapshot.docs.forEach(doc => {
      batch.set(db.collection('leaderboards').doc('weekly_archive').collection(archiveDate).doc(doc.id), doc.data());
    });
    weeklySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Weekly leaderboard reset completed');
  } catch (error) {
    console.error('Error resetting weekly leaderboard:', error);
  }
});

export const resetMonthlyLeaderboard = functions.pubsub.schedule('0 0 1 * *').onRun(async (context) => {
  const db = admin.firestore();
  try {
    const monthlySnapshot = await db.collection('leaderboards').doc('monthly').collection('entries').get();
    const archiveDate = new Date();
    archiveDate.setMonth(archiveDate.getMonth() - 1);
    const archiveKey = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, '0')}`;
    const batch = db.batch();
    monthlySnapshot.docs.forEach(doc => {
      batch.set(db.collection('leaderboards').doc('monthly_archive').collection(archiveKey).doc(doc.id), doc.data());
    });
    monthlySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Monthly leaderboard reset completed');
  } catch (error) {
    console.error('Error resetting monthly leaderboard:', error);
  }
});

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