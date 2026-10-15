import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  Timestamp, 
  deleteDoc, 
  doc, 
  updateDoc, 
  deleteField, 
  setDoc, 
  onSnapshot, 
  Unsubscribe, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config';
import { VerificationSession, VerificationHistory, Device } from '../../types';
import { logEvent } from './logs.service';
import { getAllDevices, getDevicesByPlatoonAndDohId } from './devices.service';
import { sanitizeInput, MAX_LENGTHS } from '../../utils/security';

export const getDailyDocId = (dohId: string) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${dohId}_${year}-${month}-${day}`;
};

export const getActiveSession = async (dohId: string): Promise<VerificationSession | null> => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return null;
    
    const session = { id: snap.id, ...snap.data() } as VerificationSession;
    
    // We consider it active if globalStatus is active OR if any platoon is active/completed
    if (session.globalStatus === 'archived') return null;
    
    return session;
  } catch (error) {
    console.error("Error getting active session: ", error);
    return null;
  }
};

export const startKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().globalStatus === 'archived') {
      throw new Error('ARCHIVED');
    }

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    if (snap.exists()) {
      // If doc exists, use updateDoc with dot notation to ONLY modify this specific platoon
      await updateDoc(docRef, {
        [`platoons.${platoon}.status`]: 'active',
        [`platoons.${platoon}.startedAt`]: Timestamp.fromDate(now)
      });
    } else {
      // If doc doesn't exist, create it cleanly
      const initialData = {
        dohId,
        globalStatus: 'pending',
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(endOfDay),
        platoons: {
          [platoon]: {
            status: 'active',
            startedAt: Timestamp.fromDate(now)
          }
        }
      };
      await setDoc(docRef, initialData);
    }
    
    return docId;
  } catch (error: any) {
    if (error.message !== 'ARCHIVED') {
      console.error("Error starting kashpal session: ", error);
    }
    throw error;
  }
};

export const endKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    
    const snap = await getDoc(docRef);
    const now = new Date();
    if (snap.exists()) {
      await updateDoc(docRef, {
        [`platoons.${platoon}.status`]: 'completed',
        [`platoons.${platoon}.completedAt`]: Timestamp.fromDate(now)
      });
    } else {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      await setDoc(docRef, {
        dohId,
        globalStatus: 'pending',
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(endOfDay),
        platoons: {
          [platoon]: {
            status: 'completed',
            startedAt: Timestamp.fromDate(now),
            completedAt: Timestamp.fromDate(now)
          }
        }
      }, { merge: true });
    }

    await logEvent({
      deviceId: 'PLATOON_REPORT',
      tsadiNumber: 'כללי',
      action: 'CHECKED',
      user: `קשפ"ל_${platoon}`,
      details: `סיום דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });

    // Check if the entire battalion completed or all equipment is verified!
    await checkAndAutoArchiveIfComplete(dohId);
  } catch (error) {
    console.error("Error ending kashpal session: ", error);
    throw error;
  }
};

export const reopenKashpalSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    await updateDoc(docRef, {
      [`platoons.${platoon}.status`]: 'active'
    });

    await logEvent({
      deviceId: '',
      tsadiNumber: 'כללי',
      action: 'UPDATE',
      user: 'קשר"ג',
      details: `פתיחה מחדש של דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });
  } catch (error) {
    console.error("Error reopening kashpal session: ", error);
    throw error;
  }
};

export const startGlobalSession = async (dohId: string, allPlatoons: string[]) => {
  try {
    const docId = getDailyDocId(dohId);
    const docRef = doc(db, 'verificationSessions', docId);
    const snap = await getDoc(docRef);
    
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    let existingPlatoons = {};
    if (snap.exists()) {
      existingPlatoons = (snap.data() as VerificationSession).platoons || {};
    }
    
    const platoonsUpdate: Record<string, any> = {};
    for (const p of allPlatoons) {
      if (!existingPlatoons[p as keyof typeof existingPlatoons]) {
        platoonsUpdate[p] = {
          status: 'active',
          startedAt: Timestamp.fromDate(now)
        };
      }
    }
    
    const partialData: any = {
      dohId,
      globalStatus: 'active',
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(endOfDay)
    };
    
    if (Object.keys(platoonsUpdate).length > 0) {
      partialData.platoons = platoonsUpdate;
    }
    
    await setDoc(docRef, partialData, { merge: true });
    return docId;
  } catch (error) {
    console.error("Error creating global session: ", error);
    throw error;
  }
};

export const subscribeToVerifiedDevices = (
  sessionId: string,
  onUpdate: (verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }>) => void,
  onError?: (error: Error) => void,
  platoon?: string
): Unsubscribe => {
  const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
  const q = platoon ? query(colRef, where('platoon', '==', platoon)) : colRef;
  return onSnapshot(
    q,
    (querySnapshot) => {
      const verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }> = {};
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        verifiedMap[docSnap.id] = {
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy || '',
          platoon: data.platoon
        };
      });
      onUpdate(verifiedMap);
    },
    (error) => {
      console.error("Error subscribing to verified devices: ", error);
      onError?.(error);
    }
  );
};

export const getVerifiedDevices = async (
  sessionId: string,
  platoon?: string
): Promise<Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }>> => {
  try {
    const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
    const q = platoon ? query(colRef, where('platoon', '==', platoon)) : colRef;
    const snapshot = await getDocs(q);
    const verifiedMap: Record<string, { verifiedAt: Timestamp; verifiedBy: string; platoon?: string }> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      verifiedMap[docSnap.id] = {
        verifiedAt: data.verifiedAt,
        verifiedBy: data.verifiedBy || '',
        platoon: data.platoon
      };
    });
    return verifiedMap;
  } catch (error) {
    console.error("Error getting verified devices: ", error);
    return {};
  }
};

export const verifyDevice = async (sessionId: string, deviceId: string, user: string, platoon?: string) => {
  try {
    if (!sessionId || !deviceId) return;
    const cleanSessionId = sanitizeInput(sessionId, 120);
    const cleanDeviceId = sanitizeInput(deviceId, 120);
    const cleanUser = sanitizeInput(user || 'קשפ"ל', 60);

    let resolvedPlatoon = platoon;
    if (!resolvedPlatoon && cleanUser && cleanUser.startsWith('קשפ"ל_')) {
      resolvedPlatoon = cleanUser.replace('קשפ"ל_', '');
    }
    const cleanPlatoon = resolvedPlatoon ? sanitizeInput(resolvedPlatoon, MAX_LENGTHS.PLATOON) : undefined;

    const verifiedDeviceRef = doc(db, 'verificationSessions', cleanSessionId, 'verifiedDevices', cleanDeviceId);
    const dataToSet: any = {
      verifiedAt: Timestamp.now(),
      timestamp: serverTimestamp(),
      verifiedBy: cleanUser
    };
    if (cleanPlatoon) {
      dataToSet.platoon = cleanPlatoon;
    }
    await setDoc(verifiedDeviceRef, dataToSet);

    const deviceRef = doc(db, 'devices', cleanDeviceId);
    await updateDoc(deviceRef, {
      lastChecked: Timestamp.now(),
      verifiedBy: cleanUser
    });

    // Check if 100% of all devices in the battalion are now verified!
    let dohId = '';
    if (cleanSessionId.includes('_')) {
      dohId = cleanSessionId.substring(0, cleanSessionId.lastIndexOf('_'));
    }
    if (dohId) {
      await checkAndAutoArchiveIfComplete(dohId);
    }
  } catch (error) {
    console.error("Error verifying device: ", error);
    throw error;
  }
};

export const unverifyDevice = async (sessionId: string, deviceId: string) => {
  try {
    if (!sessionId || !deviceId) return;
    const cleanSessionId = sanitizeInput(sessionId, 120);
    const cleanDeviceId = sanitizeInput(deviceId, 120);
    const verifiedDeviceRef = doc(db, 'verificationSessions', cleanSessionId, 'verifiedDevices', cleanDeviceId);
    await deleteDoc(verifiedDeviceRef);
  } catch (error) {
    console.error("Error unverifying device: ", error);
    throw error;
  }
};

export const archiveSession = async (
  session: VerificationSession, 
  devices: Device[],
  options?: {
    autoArchivedIncomplete?: boolean;
    completionNotes?: string;
  }
) => {
  if (!session.id) return;
  
  try {
    const sessionRef = doc(db, 'verificationSessions', session.id);
    const sessionSnap = await getDoc(sessionRef);
    if (sessionSnap.exists() && sessionSnap.data().globalStatus === 'archived') {
      return; // Already archived, avoid duplicate archive writes
    }

    const verifiedMap = session.verifiedDevices && Object.keys(session.verifiedDevices).length > 0
      ? session.verifiedDevices 
      : await getVerifiedDevices(session.id);

    const platoonTotals: Record<string, number> = {};
    const platoonVerified: Record<string, number> = {};
    let totalDevices = 0;
    let verifiedCount = 0;
    const missingDevices: NonNullable<VerificationHistory['missingDevices']> = [];

    devices.forEach(d => {
      const p = d.assignment || 'ללא שיוך';
      platoonTotals[p] = (platoonTotals[p] || 0) + 1;
      totalDevices++;
      
      if (d.id && verifiedMap[d.id]) {
        platoonVerified[p] = (platoonVerified[p] || 0) + 1;
        verifiedCount++;
      } else if (d.id) {
        missingDevices.push({
          id: d.id,
          type: d.type,
          tsadiNumber: d.tsadiNumber,
          assignment: d.assignment,
          location: d.location
        });
      }
    });

    const overallProgress = totalDevices > 0 ? `${verifiedCount}/${totalDevices} (${Math.round((verifiedCount / totalDevices) * 100)}%)` : '0/0 (0%)';
    
    const platoonBreakdown: Record<string, string> = {};
    Object.keys(platoonTotals).forEach(p => {
      const verified = platoonVerified[p] || 0;
      const total = platoonTotals[p];
      platoonBreakdown[p] = `${verified}/${total} (${Math.round((verified / total) * 100)}%)`;
    });

    let resolvedDohId = session.dohId;
    if (!resolvedDohId && session.id && session.id.includes('_')) {
      resolvedDohId = session.id.substring(0, session.id.lastIndexOf('_'));
    }

    let dateStr = new Date().toLocaleDateString('he-IL');
    if (session.createdAt) {
      if (typeof (session.createdAt as any).toDate === 'function') {
        dateStr = (session.createdAt as any).toDate().toLocaleDateString('he-IL');
      } else if ((session.createdAt as any).seconds) {
        dateStr = new Date((session.createdAt as any).seconds * 1000).toLocaleDateString('he-IL');
      }
    }

    const isComplete = !options?.autoArchivedIncomplete && verifiedCount === totalDevices && totalDevices > 0;
    const historyStatus = isComplete ? 'בוצע' : 'לא הושלם';

    const historyData: Omit<VerificationHistory, 'id'> = {
      dohId: resolvedDohId || '',
      date: dateStr,
      overallProgress,
      platoonBreakdown,
      status: historyStatus,
      ...(isComplete ? {} : { missingDevices }),
      archivedAt: Timestamp.now(),
      ...(options?.autoArchivedIncomplete ? { autoArchivedIncomplete: true } : {}),
      ...(options?.completionNotes ? { completionNotes: options.completionNotes } : {})
    };

    // Use deterministic history doc ID based on session.id to guarantee idempotency and avoid duplicates
    const historyDocRef = doc(db, 'verificationHistory', session.id);
    await setDoc(historyDocRef, historyData, { merge: true });

    const sessionUpdate: any = { 
      globalStatus: 'archived',
      archivedAt: serverTimestamp()
    };
    if (options?.autoArchivedIncomplete) {
      sessionUpdate.autoArchivedIncomplete = true;
    }
    if (options?.completionNotes) {
      sessionUpdate.completionNotes = options.completionNotes;
    }

    await updateDoc(sessionRef, sessionUpdate);

  } catch (error) {
    console.error("Error archiving session: ", error);
    throw error;
  }
};

export const checkAndAutoArchiveIfComplete = async (dohId: string): Promise<boolean> => {
  if (!dohId) return false;
  try {
    const docId = getDailyDocId(dohId);
    const sessionRef = doc(db, 'verificationSessions', docId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) return false;
    const sessionData = { id: snap.id, ...snap.data() } as VerificationSession;

    // Already archived
    if (sessionData.globalStatus === 'archived') return false;

    // Fetch all devices in the battalion for this dohId
    const allDevices = await getAllDevices(dohId);
    if (allDevices.length === 0) return false;

    // Fetch all verified devices in this session
    const verifiedMap = await getVerifiedDevices(docId);
    const totalDevices = allDevices.length;
    const verifiedCount = allDevices.filter(d => d.id && verifiedMap[d.id]).length;

    // 1. Condition: 100% of all devices in the battalion are verified
    const is100Percent = verifiedCount === totalDevices && totalDevices > 0;

    // 2. Condition: All platoons in the session have completed their reporting
    const platoons = sessionData.platoons || {};
    const sessionPlatoonKeys = Object.keys(platoons);
    const allPlatoonsCompleted = 
      sessionPlatoonKeys.length > 0 && 
      sessionPlatoonKeys.every(p => platoons[p]?.status === 'completed');

    if (is100Percent) {
      await archiveSession(sessionData, allDevices, {
        completionNotes: 'הדו"ח הושלם במלואו (100% אימות גדודי)'
      });

      await logEvent({
        deviceId: 'GLOBAL_REPORT',
        tsadiNumber: 'כללי',
        action: 'CHECKED',
        user: 'מערכת',
        details: `סיום ונעילת דו"ח גדודי מלא - כל ${totalDevices} הפריטים אומתו (100%) והועברו ישירות להיסטוריה כהושלם`,
        platoon: 'כללי',
        involvedPlatoons: [],
        dohId
      });

      return true;
    } else if (allPlatoonsCompleted) {
      await archiveSession(sessionData, allDevices, {
        completionNotes: `הסתיים על ידי כל הפלוגות (${verifiedCount}/${totalDevices} פריטים אומתו)`
      });

      await logEvent({
        deviceId: 'GLOBAL_REPORT',
        tsadiNumber: 'כללי',
        action: 'CHECKED',
        user: 'מערכת',
        details: `נעילת דו"ח גדודי בסיום כלל הפלוגות - ${verifiedCount}/${totalDevices} פריטים אומתו`,
        platoon: 'כללי',
        involvedPlatoons: [],
        dohId
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in checkAndAutoArchiveIfComplete:", error);
    return false;
  }
};

export const archiveExpiredSessions = async (dohId: string): Promise<number> => {
  if (!dohId) return 0;
  try {
    let snap;
    try {
      const q = query(
        collection(db, 'verificationSessions'),
        where('dohId', '==', dohId),
        where('globalStatus', 'in', ['active', 'pending'])
      );
      snap = await getDocs(q);
    } catch (queryErr) {
      console.warn("Compound query for verificationSessions failed, falling back to dohId query:", queryErr);
      const fallbackQ = query(
        collection(db, 'verificationSessions'),
        where('dohId', '==', dohId)
      );
      snap = await getDocs(fallbackQ);
    }

    if (snap.empty) return 0;

    const now = Date.now();
    const expiredSessions: VerificationSession[] = [];
    snap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as VerificationSession;
      const isPendingOrActive = data.globalStatus === 'active' || data.globalStatus === 'pending';
      const isExpired = data.expiresAt && data.expiresAt.toMillis() < now;
      if (isPendingOrActive && isExpired) {
        expiredSessions.push(data);
      }
    });

    if (expiredSessions.length === 0) return 0;

    const allDevices = await getAllDevices(dohId);

    for (const session of expiredSessions) {
      if (!session.id) continue;

      const verifiedMap = session.verifiedDevices && Object.keys(session.verifiedDevices).length > 0
        ? session.verifiedDevices
        : await getVerifiedDevices(session.id);

      let verifiedCount = 0;
      allDevices.forEach((d) => {
        if (d.id && verifiedMap[d.id]) {
          verifiedCount++;
        }
      });

      const totalExpected = allDevices.length;
      const isFullyVerified = totalExpected > 0 && verifiedCount === totalExpected;

      if (isFullyVerified) {
        // 100% complete across all devices: archive gracefully as a successful report
        await archiveSession(session, allDevices);
      } else {
        // Incomplete report: archive with midnight warning
        await archiveSession(session, allDevices, {
          autoArchivedIncomplete: true,
          completionNotes: 'אורכב אוטומטית בחצות - הדו"ח לא הושלם במלואו'
        });
      }
    }

    return expiredSessions.length;
  } catch (error) {
    console.error("Error archiving expired sessions:", error);
    return 0;
  }
};

export const getHistoryLogs = async (dohId: string): Promise<VerificationHistory[]> => {
  try {
    // Automatically archive any active session that has reached 100% or where all platoons completed
    await checkAndAutoArchiveIfComplete(dohId);

    const q = query(
      collection(db, 'verificationHistory'),
      where('dohId', '==', dohId)
    );
    const querySnapshot = await getDocs(q);
    const logs: VerificationHistory[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as VerificationHistory;

      // Auto-heal 100% completed records that were erroneously saved as incomplete
      const is100Percent = 
        Boolean(data.overallProgress && data.overallProgress.includes('(100%)')) ||
        (Boolean(data.platoonBreakdown) && 
         Object.keys(data.platoonBreakdown).length > 0 && 
         Object.values(data.platoonBreakdown).every(p => p.includes('(100%)')));

      if (is100Percent && (data.status !== 'בוצע' || data.autoArchivedIncomplete)) {
        data.status = 'בוצע';
        data.autoArchivedIncomplete = false;
        if (data.completionNotes && data.completionNotes.includes('לא הושלם')) {
          delete data.completionNotes;
        }
        // Permanently heal the record in Firestore in the background
        updateDoc(doc(db, 'verificationHistory', docSnap.id), {
          status: 'בוצע',
          autoArchivedIncomplete: deleteField(),
          completionNotes: deleteField()
        }).catch((err) => console.warn('Background history healing failed:', err));
      }

      logs.push(data);
    });
    // Sort locally to avoid composite index requirement
    return logs.sort((a, b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0));
  } catch (error) {
    console.error("Error getting history logs: ", error);
    return [];
  }
};

export const deleteHistoryLog = async (logId: string) => {
  try {
    if (!logId || typeof logId !== 'string') return;
    const cleanId = sanitizeInput(logId, 120);
    const logRef = doc(db, 'verificationHistory', cleanId);
    
    // Log the deletion to the immutable military audit trail before removing the record
    const snap = await getDoc(logRef);
    if (snap.exists()) {
      const data = snap.data();
      await logEvent({
        deviceId: 'HISTORY_REPORT',
        tsadiNumber: 'כללי',
        action: 'DELETE',
        user: 'קשר"ג',
        details: `מחיקת היסטוריית דו"ח מיום ${data.date || 'לא ידוע'}`,
        platoon: 'כללי',
        involvedPlatoons: [],
        dohId: data.dohId
      });
    }

    await deleteDoc(logRef);
  } catch (error) {
    console.error("Error deleting history log: ", error);
    throw error;
  }
};

export const resetSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, 'verificationSessions', sessionId);
    
    // Fetch the current session to get the platoons
    const docSnap = await getDoc(sessionRef);
    if (!docSnap.exists()) return;
    
    const sessionData = docSnap.data();
    const existingPlatoons = sessionData.platoons || {};
    
    // Reset all platoons to 'active'
    const updatedPlatoons: any = {};
    for (const p in existingPlatoons) {
      updatedPlatoons[p] = {
        ...existingPlatoons[p],
        status: 'active'
      };
    }
    
    await updateDoc(sessionRef, { 
      platoons: updatedPlatoons
    });

    // Delete all docs in verifiedDevices subcollection
    const colRef = collection(db, 'verificationSessions', sessionId, 'verifiedDevices');
    const verifiedSnap = await getDocs(colRef);
    const deletePromises = verifiedSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error resetting session: ", error);
    throw error;
  }
};

export const resetPlatoonSession = async (dohId: string, platoon: string) => {
  try {
    const docId = getDailyDocId(dohId);
    const sessionRef = doc(db, 'verificationSessions', docId);
    
    // 1. Reset platoon status to 'active'
    await updateDoc(sessionRef, {
      [`platoons.${platoon}.status`]: 'active'
    });

    // 2. Delete all docs in verifiedDevices subcollection that belong to this platoon
    const colRef = collection(db, 'verificationSessions', docId, 'verifiedDevices');
    const q = query(colRef, where('platoon', '==', platoon));
    const verifiedSnap = await getDocs(q);
    const deletePromises = verifiedSnap.docs.map(d => deleteDoc(d.ref));
    
    // Also safeguard against any devices assigned to this platoon
    const platoonDevices = await getDevicesByPlatoonAndDohId(platoon, dohId);
    for (const d of platoonDevices) {
      if (d.id) {
        deletePromises.push(deleteDoc(doc(db, 'verificationSessions', docId, 'verifiedDevices', d.id)).catch(() => {}));
      }
    }
    
    await Promise.all(deletePromises);

    // 3. Log event
    await logEvent({
      deviceId: '',
      tsadiNumber: 'כללי',
      action: 'UPDATE',
      user: 'קשר"ג',
      details: `איפוס דו"ח יומי עבור ${platoon}`,
      platoon,
      involvedPlatoons: [platoon],
      dohId
    });
  } catch (error) {
    console.error("Error resetting platoon session: ", error);
    throw error;
  }
};
